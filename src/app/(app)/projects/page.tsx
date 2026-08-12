import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjectIds, projectWhere } from "@/lib/permissions";
import { getProjectHealth } from "@/lib/projects";
import { HealthBadge, KindBadge, StatusPill, Th, Td, EmptyState } from "@/components/ui";
import { moneyCompact, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const showArchived = show === "archived";

  const visible = await getVisibleProjectIds(user);
  const projects = await db.project.findMany({
    where: {
      ...projectWhere(visible),
      ...(showArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
    },
    include: {
      client: { include: { division: true } },
      owner: true,
      tasks: { where: { archivedAt: null }, select: { id: true, dueDate: true, completedAt: true } },
      verticals: { include: { vertical: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const healths = await Promise.all(projects.map((p) => (p.archivedAt ? Promise.resolve("on_track" as const) : getProjectHealth(p.id))));
  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-slate-500">
            {showArchived ? "Archived — history is never deleted." : "Every active engagement across every business."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={showArchived ? "/projects" : "/projects?show=archived"} className="btn-ghost">
            {showArchived ? "Show active" : "Show archived"}
          </Link>
          <Link href="/projects/new" className="btn-primary">+ New project</Link>
        </div>
      </header>

      {projects.length === 0 ? (
        <EmptyState title={showArchived ? "Nothing archived yet." : "No projects in your scope."} hint="Create one from a template." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-slate-100">
              <tr>
                <Th>Project</Th><Th>Business</Th><Th>Health</Th><Th>PM</Th><Th>Verticals</Th><Th>Open / overdue</Th><Th>Value</Th><Th>Timeline</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => {
                const open = p.tasks.filter((t) => !t.completedAt);
                const over = open.filter((t) => t.dueDate < now);
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <Td><Link href={`/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link></Td>
                    <Td>
                      <span className="flex items-center gap-1.5">{p.client.name} <KindBadge kind={p.client.kind} /></span>
                    </Td>
                    <Td>{p.archivedAt ? "—" : <HealthBadge health={healths[i]} />}</Td>
                    <Td>{p.owner.name}</Td>
                    <Td className="text-xs">{p.verticals.map((v) => v.vertical.name).join(", ")}</Td>
                    <Td>
                      {open.length}
                      {over.length > 0 && <span className="font-semibold text-rose-600"> · {over.length} ⚠</span>}
                    </Td>
                    <Td>{p.value ? moneyCompact(p.value) : "—"}</Td>
                    <Td className="text-xs">{fmtDate(p.startDate)} → {p.endDate ? fmtDate(p.endDate) : "open"}</Td>
                    <Td><StatusPill status={p.archivedAt ? "archived" : p.status} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
