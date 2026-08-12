import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeProject, canManageProject } from "@/lib/permissions";
import { getProjectHealth } from "@/lib/projects";
import { getWorkload } from "@/lib/workload";
import TaskBoard, { type BoardTask } from "@/components/TaskBoard";
import QuickForm from "@/components/QuickForm";
import { Avatar, DueBadge, HealthBadge, KindBadge, PriorityBadge, SectionTitle, EmptyState, StatusPill, TaskRow, Th, Td } from "@/components/ui";
import { fmtDate, fmtDateTime, money, moneyCompact } from "@/lib/format";
import { TICKET_TYPES } from "@/lib/constants";
import CompleteMilestoneButton from "./CompleteMilestoneButton";

export const dynamic = "force-dynamic";

// Project page: overview + one kanban per attached vertical +
// milestones + tickets + assets + activity + task sheet.
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; vertical?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { tab = "boards", vertical: verticalFilter } = await searchParams;

  if (!(await canSeeProject(user, id))) notFound();

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: { include: { division: true } },
      owner: true,
      template: true,
      verticals: {
        include: { vertical: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } } },
      },
      milestones: { where: { archivedAt: null }, orderBy: { dueDate: "asc" } },
      tasks: {
        where: { archivedAt: null },
        include: { assignee: true, stage: true, vertical: true, masterTask: true, project: { include: { client: true } } },
        orderBy: { dueDate: "asc" },
      },
      assets: { where: { archivedAt: null }, include: { registeredBy: true, parentAsset: true }, orderBy: { createdAt: "desc" } },
      invoices: { where: { archivedAt: null }, orderBy: { issueDate: "desc" } },
    },
  });
  if (!project) notFound();

  const [health, load, activity, allVerticals] = await Promise.all([
    getProjectHealth(id),
    getWorkload(),
    db.activityLog.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 60 }),
    db.vertical.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" } }),
  ]);
  const people = await db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  const loadLabel = (pid: string) => {
    const l = load.find((x) => x.userId === pid);
    return l ? `${l.loadHours}h/${l.capacityHours}h` : "";
  };

  const now = new Date();
  const open = project.tasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => t.dueDate < now);
  const tickets = project.tasks.filter((t) => t.isTicket);
  const isManager = await canManageProject(user, id);

  const attachedVerticals = project.verticals.map((pv) => pv.vertical);
  const shownVerticals = verticalFilter ? attachedVerticals.filter((v) => v.id === verticalFilter) : attachedVerticals;
  const unattached = allVerticals.filter((v) => !attachedVerticals.some((a) => a.id === v.id));

  // Variation matrix: group variation tasks under their master.
  const variationGroups = new Map<string, { master: (typeof project.tasks)[number]; variations: typeof project.tasks }>();
  for (const t of project.tasks) {
    if (t.masterTaskId && t.masterTask) {
      const g = variationGroups.get(t.masterTaskId) ?? {
        master: project.tasks.find((x) => x.id === t.masterTaskId) ?? { ...t.masterTask, assignee: t.assignee, stage: t.stage, vertical: t.vertical, project: t.project, masterTask: null } as never,
        variations: [] as typeof project.tasks,
      };
      g.variations.push(t);
      variationGroups.set(t.masterTaskId, g);
    }
  }

  const tabs = [
    ["boards", "Boards"],
    ["list", `List (${open.length})`],
    ["milestones", `Milestones (${project.milestones.length})`],
    ["tickets", `Tickets (${tickets.filter((t) => !t.completedAt).length})`],
    ["assets", `Assets (${project.assets.length})`],
    ["sheet", "Sheet"],
    ["activity", "Activity"],
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Link href="/clients" className="hover:underline">Businesses</Link> /{" "}
          <Link href={`/clients/${project.client.slug}`} className="hover:underline">{project.client.name}</Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <HealthBadge health={health} />
          <KindBadge kind={project.client.kind} />
          {project.archivedAt && <StatusPill status="archived" />}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          PM <Link className="font-medium text-brand-700 hover:underline" href={`/people/${project.ownerId}`}>{project.owner.name}</Link>
          {" · "}{fmtDate(project.startDate)} → {project.endDate ? fmtDate(project.endDate) : "open"}
          {project.value > 0 && <> · {moneyCompact(project.value)}</>}
          {project.template && <> · from template “{project.template.name}”</>}
          {" · "}{open.length} open{overdue.length > 0 && <span className="font-semibold text-rose-600"> · {overdue.length} overdue</span>}
        </p>
      </header>

      <nav className="flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/projects/${id}?tab=${key}`} className={`tab ${tab === key ? "tab-active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "boards" && (
        <div className="space-y-8">
          {attachedVerticals.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Link href={`/projects/${id}?tab=boards`} className={`chip ${!verticalFilter ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                All verticals
              </Link>
              {attachedVerticals.map((v) => (
                <Link
                  key={v.id}
                  href={`/projects/${id}?tab=boards&vertical=${v.id}`}
                  className={`chip ${verticalFilter === v.id ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {v.name}
                </Link>
              ))}
            </div>
          )}

          {shownVerticals.map((v) => {
            const boardTasks: BoardTask[] = project.tasks
              .filter((t) => t.verticalId === v.id)
              .map((t) => ({
                id: t.id,
                title: t.title,
                stageId: t.stageId,
                priority: t.priority,
                dueDate: t.dueDate.toISOString(),
                isTicket: t.isTicket,
                isOverdue: !t.completedAt && t.dueDate < now,
                isVariation: !!t.masterTaskId,
                completedAt: t.completedAt?.toISOString() ?? null,
                assignee: { name: t.assignee.name, avatarColor: t.assignee.avatarColor },
              }));
            return (
              <section key={v.id}>
                <SectionTitle>{v.name}</SectionTitle>
                <TaskBoard stages={v.stages} tasks={boardTasks} />
              </section>
            );
          })}
          {attachedVerticals.length === 0 && (
            <EmptyState title="No verticals attached." hint="Attach one below to get its kanban board." />
          )}

          <QuickForm
            title="New task"
            endpoint="/api/tasks"
            submitLabel="Create task"
            extra={{ projectId: id }}
            fields={[
              { name: "title", label: "Title", required: true },
              {
                name: "verticalId", label: "Vertical", type: "select", required: true,
                options: attachedVerticals.map((v) => ({ value: v.id, label: v.name })),
              },
              {
                name: "assigneeId", label: "Assignee (load shown)", type: "select", required: true,
                options: people.map((p) => ({ value: p.id, label: `${p.name} — ${loadLabel(p.id)}` })),
              },
              { name: "dueDate", label: "Due date (mandatory)", type: "date", required: true },
              {
                name: "priority", label: "Priority", type: "select", required: true, defaultValue: "medium",
                options: ["low", "medium", "high", "urgent"].map((p) => ({ value: p, label: p })),
              },
              { name: "estimateHours", label: "Estimate (hours)", type: "number", min: 0, step: 0.5 },
              {
                name: "masterTaskId", label: "Variation of (master task)", type: "select",
                options: project.tasks.filter((t) => !t.masterTaskId).map((t) => ({ value: t.id, label: t.title })),
                hint: "Only for variation tasks — links them to their master.",
              },
              { name: "description", label: "Description", type: "textarea" },
            ]}
          />

          {isManager && unattached.length > 0 && (
            <QuickForm
              title="Attach a vertical"
              endpoint={`/api/projects/${id}`}
              method="PATCH"
              submitLabel="Attach vertical"
              fields={[
                {
                  name: "addVerticalId", label: "Vertical", type: "select", required: true,
                  options: unattached.map((v) => ({ value: v.id, label: v.name })),
                },
              ]}
            />
          )}

          {variationGroups.size > 0 && (
            <section>
              <SectionTitle>Variation matrix</SectionTitle>
              <div className="space-y-3">
                {[...variationGroups.values()].map(({ master, variations }) => {
                  const delivered = variations.filter((v) => v.completedAt).length;
                  const late = variations.filter((v) => !v.completedAt && v.dueDate < now).length;
                  return (
                    <div key={master.id} className="card p-4">
                      <p className="text-sm font-semibold">
                        <Link href={`/tasks/${master.id}`} className="text-brand-700 hover:underline">{master.title}</Link>
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          → {variations.length} variation(s) · {delivered} delivered
                          {late > 0 && <span className="font-semibold text-rose-600"> · {late} overdue</span>}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {variations.map((v) => (
                          <Link
                            key={v.id}
                            href={`/tasks/${v.id}`}
                            className={`chip ${
                              v.completedAt
                                ? "bg-emerald-100 text-emerald-700"
                                : v.dueDate < now
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-600"
                            } hover:opacity-80`}
                          >
                            {v.title} · {v.stage.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "list" && (
        <div className="card">
          {/* Overdue pinned to top */}
          {[...overdue, ...open.filter((t) => t.dueDate >= now), ...project.tasks.filter((t) => t.completedAt)].map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {project.tasks.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">No tasks yet.</p>}
        </div>
      )}

      {tab === "milestones" && (
        <div className="space-y-4">
          {project.milestones.length === 0 ? (
            <EmptyState title="No milestones." />
          ) : (
            <div className="card">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {m.status === "completed" ? "✅" : "◇"} {m.title}
                      {m.billable && <span className="ml-2 chip bg-emerald-50 text-emerald-700">billable {m.amount ? moneyCompact(m.amount) : ""}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      due {fmtDate(m.dueDate)}{m.completedAt && ` · completed ${fmtDate(m.completedAt)}`}
                    </p>
                  </div>
                  {m.status !== "completed" && <DueBadge due={m.dueDate} />}
                  {m.status !== "completed" && isManager && (
                    <CompleteMilestoneButton milestoneId={m.id} billable={m.billable} />
                  )}
                </div>
              ))}
            </div>
          )}
          {isManager && (
            <QuickForm
              title="Add milestone"
              endpoint="/api/milestones"
              submitLabel="Add milestone"
              extra={{ projectId: id }}
              fields={[
                { name: "title", label: "Title", required: true },
                { name: "dueDate", label: "Due date", type: "date", required: true },
                {
                  name: "billable", label: "Billable?", type: "select",
                  options: [{ value: "", label: "No" }, { value: "1", label: "Yes" }],
                },
                { name: "amount", label: "Amount", type: "number", min: 0 },
              ]}
            />
          )}
        </div>
      )}

      {tab === "tickets" && (
        <div className="space-y-4">
          <QuickForm
            title="Raise ticket (change request / bug / revision)"
            endpoint="/api/tickets"
            submitLabel="Raise ticket"
            extra={{ projectId: id }}
            fields={[
              { name: "title", label: "What needs to change?", required: true },
              {
                name: "ticketType", label: "Type", type: "select", required: true,
                options: TICKET_TYPES.map((t) => ({ value: t, label: t })),
              },
              {
                name: "assigneeId", label: "Assignee", type: "select", required: true,
                options: people.map((p) => ({ value: p.id, label: `${p.name} — ${loadLabel(p.id)}` })),
              },
              { name: "dueDate", label: "SLA due date", type: "date", required: true },
              {
                name: "priority", label: "Priority", type: "select", required: true, defaultValue: "high",
                options: ["low", "medium", "high", "urgent"].map((p) => ({ value: p, label: p })),
              },
              { name: "estimateHours", label: "Estimate (hours)", type: "number", min: 0, step: 0.5 },
              { name: "description", label: "Details", type: "textarea" },
            ]}
          />
          {tickets.length === 0 ? (
            <EmptyState title="No tickets." hint="Tickets are tasks in the Change Requests vertical — they hit workload and escalations like everything else." />
          ) : (
            <div className="card">{tickets.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          )}
        </div>
      )}

      {tab === "assets" && (
        <div className="space-y-4">
          <QuickForm
            title="Register asset on this project"
            endpoint="/api/assets"
            submitLabel="Register asset"
            extra={{ clientId: project.clientId, projectId: id }}
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "url", label: "Link", type: "url", required: true },
              {
                name: "type", label: "Type", type: "select", required: true,
                options: ["footage", "master", "final", "doc", "image", "design", "other"].map((t) => ({ value: t, label: t })),
              },
              {
                name: "parentAssetId", label: "Derived from", type: "select",
                options: project.assets.map((a) => ({ value: a.id, label: a.name })),
              },
              {
                name: "taskId", label: "Link to task (as output)", type: "select",
                options: project.tasks.map((t) => ({ value: t.id, label: t.title })),
              },
              { name: "tags", label: "Tags" },
            ]}
          />
          {project.assets.length === 0 ? (
            <EmptyState title="No assets registered on this project." />
          ) : (
            <div className="card">
              {project.assets.map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0">
                  <span className="chip bg-slate-100 text-slate-600">{a.type}</span>
                  <div className="min-w-0 flex-1">
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">{a.name} ↗</a>
                    <p className="text-xs text-slate-400">
                      {a.parentAsset && `↳ from ${a.parentAsset.name} · `}by {a.registeredBy.name} · {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  {a.isDeliverable && <span className="chip bg-emerald-100 text-emerald-700">deliverable</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sheet" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-slate-100">
              <tr><Th>Task</Th><Th>Vertical</Th><Th>Stage</Th><Th>Assignee</Th><Th>Priority</Th><Th>Est (h)</Th><Th>Due</Th><Th>Original due</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {project.tasks.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <Td><Link href={`/tasks/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.title}</Link></Td>
                  <Td>{t.vertical.name}</Td>
                  <Td>{t.stage.name}</Td>
                  <Td>{t.assignee.name}</Td>
                  <Td><PriorityBadge priority={t.priority} /></Td>
                  <Td>{t.estimateHours || "—"}</Td>
                  <Td>{fmtDate(t.dueDate)}</Td>
                  <Td className={t.originalDueDate.getTime() !== t.dueDate.getTime() ? "text-amber-600" : ""}>{fmtDate(t.originalDueDate)}</Td>
                  <Td><DueBadge due={t.dueDate} completed={!!t.completedAt} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "activity" && (
        <div className="card">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0">
              <span className={`mt-0.5 chip ${a.actorId ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
                {a.actorId ? a.actorName : "SYSTEM"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{a.action.replace(/[._]/g, " ")}</span>
                  {" — "}
                  <span className="text-slate-500">{a.entityType}</span>
                  {a.fromValue && a.toValue && (
                    <span className="text-slate-500"> · {shorten(a.fromValue)} → {shorten(a.toValue)}</span>
                  )}
                  {!a.fromValue && a.toValue && <span className="text-slate-500"> · {shorten(a.toValue)}</span>}
                </p>
                <p className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</p>
              </div>
              {a.taskId && <Link href={`/tasks/${a.taskId}`} className="text-xs text-brand-600 hover:underline">view →</Link>}
            </div>
          ))}
          {activity.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</p>}
        </div>
      )}
    </div>
  );
}

function shorten(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDate(new Date(v));
  return v.length > 60 ? v.slice(0, 57) + "…" : v;
}
