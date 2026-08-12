import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjectIds, taskProjectWhere } from "@/lib/permissions";
import { DueBadge, PriorityBadge, SectionTitle, Th, Td, EmptyState } from "@/components/ui";
import { fmtDate, durationShort } from "@/lib/format";

export const dynamic = "force-dynamic";

// Task sheets & reports: live filterable sheet with time-in-stage,
// CSV export, and stage-duration analytics computed from the activity log.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; projectId?: string; clientId?: string; from?: string; to?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isLead && !user.isFinance) redirect("/my-work");
  const filters = await searchParams;

  const visible = await getVisibleProjectIds(user);
  const [people, projects, clients] = await Promise.all([
    db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  const tasks = await db.task.findMany({
    where: {
      ...taskProjectWhere(visible),
      archivedAt: null,
      ...(filters.userId ? { assigneeId: filters.userId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.clientId ? { project: { clientId: filters.clientId } } : {}),
      ...(filters.from || filters.to
        ? {
            dueDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to + "T23:59:59") } : {}),
            },
          }
        : {}),
    },
    include: { assignee: true, project: { include: { client: true } }, vertical: true, stage: true },
    orderBy: { dueDate: "asc" },
    take: 500,
  });

  // Stage-duration analytics per vertical from stage_moved log entries.
  const moves = await db.activityLog.findMany({
    where: { action: "stage_moved", ...(visible === "all" ? {} : { projectId: { in: visible } }) },
    orderBy: { createdAt: "asc" },
  });
  const enters = new Map<string, { stage: string; at: Date; verticalName?: string }>();
  const durations = new Map<string, { total: number; count: number }>(); // "vertical|stage" -> agg
  const taskVertical = new Map(tasks.map((t) => [t.id, t.vertical.name]));
  const allTaskVerticals = new Map<string, string>();
  const verticalRows = await db.task.findMany({ where: { archivedAt: null }, select: { id: true, vertical: { select: { name: true } } } });
  for (const r of verticalRows) allTaskVerticals.set(r.id, r.vertical.name);
  for (const m of moves) {
    if (!m.taskId || !m.fromValue || !m.toValue) continue;
    const prev = enters.get(m.taskId);
    const verticalName = taskVertical.get(m.taskId) ?? allTaskVerticals.get(m.taskId);
    if (!verticalName) continue;
    const enteredAt = prev?.at ?? m.createdAt;
    const stage = m.fromValue;
    const key = `${verticalName}|${stage}`;
    const agg = durations.get(key) ?? { total: 0, count: 0 };
    agg.total += m.createdAt.getTime() - enteredAt.getTime();
    agg.count += 1;
    durations.set(key, agg);
    enters.set(m.taskId, { stage: m.toValue, at: m.createdAt });
  }
  const analytics = [...durations.entries()]
    .map(([key, agg]) => {
      const [vertical, stage] = key.split("|");
      return { vertical, stage, avgMs: agg.total / agg.count, samples: agg.count };
    })
    .filter((a) => a.samples >= 1 && a.avgMs > 0)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 12);

  const csvParams = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Task sheets & reports</h1>
          <p className="text-sm text-slate-500">Auto-generated live from the activity log — per person, project, client, any range.</p>
        </div>
        <a href={`/api/reports/sheet?${csvParams}`} className="btn-primary">Export CSV</a>
      </header>

      <form method="GET" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="label">Person</label>
          <select name="userId" className="input" defaultValue={filters.userId ?? ""}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="input" defaultValue={filters.clientId ?? ""}>
            <option value="">All</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Project</label>
          <select name="projectId" className="input" defaultValue={filters.projectId ?? ""}>
            <option value="">All</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Due from</label>
          <input type="date" name="from" className="input" defaultValue={filters.from ?? ""} />
        </div>
        <div>
          <label className="label">Due to</label>
          <input type="date" name="to" className="input" defaultValue={filters.to ?? ""} />
        </div>
        <div className="flex items-end">
          <button className="btn-ghost w-full">Apply</button>
        </div>
      </form>

      <section>
        <SectionTitle>Sheet ({tasks.length} row(s))</SectionTitle>
        {tasks.length === 0 ? (
          <EmptyState title="Nothing matches those filters." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-100">
                <tr><Th>Task</Th><Th>Client / project</Th><Th>Vertical → stage</Th><Th>Assignee</Th><Th>Priority</Th><Th>Est</Th><Th>Due</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <Td><Link href={`/tasks/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.title}</Link></Td>
                    <Td className="text-xs">{t.project.client.name} · {t.project.name}</Td>
                    <Td className="text-xs">{t.vertical.name} → {t.stage.name}</Td>
                    <Td>{t.assignee.name}</Td>
                    <Td><PriorityBadge priority={t.priority} /></Td>
                    <Td>{t.estimateHours || "—"}</Td>
                    <Td>{fmtDate(t.dueDate)}</Td>
                    <Td><DueBadge due={t.dueDate} completed={!!t.completedAt} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Stage-duration analytics — slowest stages first</SectionTitle>
        {analytics.length === 0 ? (
          <EmptyState title="Not enough stage-move history yet." hint="As tasks move through pipelines, averages appear here." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="border-b border-slate-100">
                <tr><Th>Vertical</Th><Th>Stage</Th><Th>Avg time in stage</Th><Th>Samples</Th></tr>
              </thead>
              <tbody>
                {analytics.map((a) => (
                  <tr key={`${a.vertical}|${a.stage}`} className="border-b border-slate-50 last:border-0">
                    <Td>{a.vertical}</Td>
                    <Td>{a.stage}</Td>
                    <Td className="font-semibold">{durationShort(a.avgMs)}</Td>
                    <Td>{a.samples}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
