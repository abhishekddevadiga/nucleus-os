import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, SectionTitle, TaskRow, EmptyState, Th, Td } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// A person's full sheet (spec journey #1): current work, overdue, recent
// completions, recent activity. One click from the Command Center.
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login");
  const { id } = await params;
  if (!viewer.isOwner && !viewer.isLead && viewer.id !== id) redirect("/my-work");

  const person = await db.user.findUnique({
    where: { id },
    include: { roleAssignments: true },
  });
  if (!person) notFound();

  const now = new Date();
  const [openTasks, recentDone, activity] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: id, archivedAt: null, completedAt: null },
      include: { stage: true, workstream: true, campaign: { include: { business: true } }, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: { assigneeId: id, archivedAt: null, completedAt: { not: null } },
      include: { stage: true, workstream: true, campaign: { include: { business: true } }, assignee: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    db.activityLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const overdue = openTasks.filter((t) => t.dueDate < now);
  const roles = [...new Set(person.roleAssignments.map((r) => ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role))];

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <Avatar name={person.name} color={person.avatarColor} size={9} />
        <div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <p className="text-sm text-slate-500">
            {person.title ?? "—"} · {roles.join(", ")} · capacity {person.capacityHours}h/week
          </p>
        </div>
      </header>

      {overdue.length > 0 && (
        <section>
          <SectionTitle><span className="text-rose-600">Overdue ({overdue.length})</span></SectionTitle>
          <div className="card">{overdue.map((t) => <TaskRow key={t.id} task={t as any} />)}</div>
        </section>
      )}

      <section>
        <SectionTitle>Open work ({openTasks.length})</SectionTitle>
        {openTasks.length === 0 ? (
          <EmptyState title="No open tasks." />
        ) : (
          <div className="card">{openTasks.filter((t) => t.dueDate >= now).map((t) => <TaskRow key={t.id} task={t as any} />)}</div>
        )}
      </section>

      {recentDone.length > 0 && (
        <section>
          <SectionTitle>Recently completed</SectionTitle>
          <div className="card">{recentDone.map((t) => <TaskRow key={t.id} task={t as any} />)}</div>
        </section>
      )}

      <section>
        <SectionTitle>Recent activity</SectionTitle>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="border-b border-slate-100"><tr><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>Change</Th></tr></thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0">
                  <Td className="text-xs">{fmtDateTime(a.createdAt)}</Td>
                  <Td>{a.action.replace(/[._]/g, " ")}</Td>
                  <Td className="text-xs">{a.entityType}</Td>
                  <Td className="text-xs">{a.fromValue && a.toValue ? `${trim(a.fromValue)} → ${trim(a.toValue)}` : trim(a.toValue ?? "")}</Td>
                </tr>
              ))}
              {activity.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function trim(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return v.length > 40 ? v.slice(0, 37) + "…" : v;
}
