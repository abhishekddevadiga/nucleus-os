import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeProject, canManageProject } from "@/lib/permissions";
import { getWorkload } from "@/lib/workload";
import { Avatar, DueBadge, PriorityBadge, SectionTitle, StatusPill } from "@/components/ui";
import { StageMover, DeadlineChanger, ExtensionRequester, ExtensionDecider, Reassigner, SubtaskToggle, CommentBox } from "@/components/TaskActions";
import QuickForm from "@/components/QuickForm";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

// Task detail: properties, subtasks, linked assets, comments,
// extension requests, and the full immutable activity timeline. If overdue:
// live escalation-ladder status.
export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: { include: { client: true } },
      vertical: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } },
      stage: true,
      assignee: true,
      creator: true,
      raisedBy: true,
      masterTask: true,
      variations: { include: { stage: true } },
      subtasks: { orderBy: { createdAt: "asc" } },
      assetLinks: { include: { asset: true } },
      extensionRequests: { include: { requestedBy: true, decidedBy: true }, orderBy: { createdAt: "desc" } },
      watchers: { include: { user: true } },
    },
  });
  if (!task) notFound();
  if (!(await canSeeProject(user, task.projectId)) && task.assigneeId !== user.id) notFound();

  const [comments, activity, load, isManager] = await Promise.all([
    db.comment.findMany({ where: { entityType: "task", entityId: id }, include: { author: true }, orderBy: { createdAt: "asc" } }),
    db.activityLog.findMany({ where: { taskId: id }, orderBy: { createdAt: "desc" } }),
    getWorkload(),
    canManageProject(user, task.projectId),
  ]);
  const people = await db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  const now = new Date();
  const isOverdue = !task.completedAt && task.dueDate < now;
  const deadlineMoved = task.originalDueDate.getTime() !== task.dueDate.getTime();
  const isAssignee = task.assigneeId === user.id;

  const ladder = [
    { level: 1, label: "T−24h · assignee reminded" },
    { level: 2, label: "T crossed · OVERDUE, PM notified" },
    { level: 3, label: "T+24h · escalated to CEO/Ops" },
    { level: 4, label: "T+48h · review scheduled, deadline edits locked" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Link href={`/clients/${task.project.client.slug}`} className="hover:underline">{task.project.client.name}</Link>
          {" / "}
          <Link href={`/projects/${task.projectId}`} className="hover:underline">{task.project.name}</Link>
          {" / "}{task.vertical.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {task.isTicket && <span className="mr-2 rounded bg-fuchsia-100 px-1.5 py-0.5 align-middle text-xs font-bold text-fuchsia-700">TICKET · {task.ticketType}</span>}
          {task.masterTaskId && <span className="mr-2 rounded bg-indigo-100 px-1.5 py-0.5 align-middle text-xs font-bold text-indigo-700">VARIATION</span>}
          {task.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <DueBadge due={task.dueDate} completed={!!task.completedAt} />
          {task.deadlineLocked && <span className="chip bg-rose-600 text-white">🔒 deadline locked</span>}
          <span className="chip bg-slate-100 text-slate-600">{task.estimateHours}h est</span>
          {task.tags?.split(",").map((t) => <span key={t} className="chip bg-slate-50 text-slate-500">#{t.trim()}</span>)}
        </div>
      </header>

      {/* Escalation ladder — visible whenever the deadline is near/past */}
      {(isOverdue || task.escalationLevel > 0) && !task.completedAt && (
        <div className="card border-rose-200 p-4">
          <SectionTitle>Escalation ladder</SectionTitle>
          <ol className="space-y-1.5">
            {ladder.map((rung) => (
              <li key={rung.level} className={`flex items-center gap-2 text-sm ${task.escalationLevel >= rung.level ? "font-medium text-rose-700" : "text-slate-400"}`}>
                <span>{task.escalationLevel >= rung.level ? "●" : "○"}</span> {rung.label}
                {task.escalationLevel >= rung.level && <span className="text-xs">— fired</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Pipeline stage — progress reporting IS moving the stage */}
      <div className="card p-4">
        <SectionTitle>Pipeline · {task.vertical.name}</SectionTitle>
        <StageMover taskId={task.id} stages={task.vertical.stages} currentStageId={task.stageId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="label">Assignee (exactly one, always)</p>
          {isManager ? (
            <Reassigner
              taskId={task.id}
              currentAssigneeId={task.assigneeId}
              people={people.map((p) => {
                const l = load.find((x) => x.userId === p.id);
                return { id: p.id, name: p.name, loadLabel: l ? `${l.loadHours}h/${l.capacityHours}h (${l.band})` : "" };
              })}
            />
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium">
              <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={6} /> {task.assignee.name}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">Created by {task.creator.name} · {fmtDate(task.createdAt)}</p>
          {task.raisedBy && <p className="text-xs text-slate-400">Raised by {task.raisedBy.name}</p>}
        </div>

        <div className="card p-4">
          <p className="label">Deadline</p>
          <p className="text-sm font-semibold">{fmtDateTime(task.dueDate)}</p>
          {deadlineMoved && (
            <p className="mt-0.5 text-xs text-amber-600">
              Original: {fmtDateTime(task.originalDueDate)} — shown forever
            </p>
          )}
          {!task.completedAt && (
            <div className="mt-3 space-y-3">
              {isManager && <DeadlineChanger taskId={task.id} current={task.dueDate.toISOString()} locked={task.deadlineLocked && !user.isCeo} />}
              {isAssignee && !isManager && (
                <>
                  <p className="text-xs text-slate-400">You can&apos;t edit your own deadline — request an extension:</p>
                  <ExtensionRequester taskId={task.id} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <div className="card p-4">
          <SectionTitle>Description</SectionTitle>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
        </div>
      )}

      {/* Extension requests */}
      {(task.extensionRequests.length > 0 || isAssignee) && (
        <div className="card p-4">
          <SectionTitle>Extension requests</SectionTitle>
          {task.extensionRequests.length === 0 && <p className="text-sm text-slate-400">None yet.</p>}
          <div className="space-y-2">
            {task.extensionRequests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{r.requestedBy.name}</span> → {fmtDate(r.requestedDate)}
                    <span className="text-slate-500"> · {r.reason}</span>
                  </p>
                  {r.decidedBy && (
                    <p className="text-xs text-slate-400">
                      {r.status} by {r.decidedBy.name} {r.decidedAt && `· ${fmtDateTime(r.decidedAt)}`}{r.decisionNote && ` · ${r.decisionNote}`}
                    </p>
                  )}
                </div>
                <StatusPill status={r.status} />
                {r.status === "pending" && isManager && <ExtensionDecider requestId={r.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variations of this master */}
      {task.variations.length > 0 && (
        <div className="card p-4">
          <SectionTitle>Variations of this master ({task.variations.length})</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {task.variations.map((v) => (
              <Link key={v.id} href={`/tasks/${v.id}`} className={`chip ${v.completedAt ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"} hover:opacity-80`}>
                {v.title} · {v.stage.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {task.masterTask && (
        <p className="text-sm text-slate-500">
          ↳ Variation of{" "}
          <Link href={`/tasks/${task.masterTask.id}`} className="font-medium text-brand-700 hover:underline">
            {task.masterTask.title}
          </Link>
        </p>
      )}

      {/* Subtasks */}
      <div className="card p-4">
        <SectionTitle>Subtasks ({task.subtasks.filter((s) => s.done).length}/{task.subtasks.length})</SectionTitle>
        <div className="space-y-1.5">
          {task.subtasks.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <SubtaskToggle id={s.id} done={s.done} />
              <span className={s.done ? "text-slate-400 line-through" : "text-slate-700"}>{s.title}</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <QuickForm
            alwaysOpen
            endpoint={`/api/tasks/${task.id}/subtasks`}
            submitLabel="Add subtask"
            fields={[{ name: "title", label: "New subtask", required: true, placeholder: "Break the work down…" }]}
          />
        </div>
      </div>

      {/* Linked assets */}
      {task.assetLinks.length > 0 && (
        <div className="card p-4">
          <SectionTitle>Linked assets</SectionTitle>
          <div className="space-y-1.5">
            {task.assetLinks.map((l) => (
              <p key={l.id} className="text-sm">
                <span className={`chip mr-2 ${l.direction === "input" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>{l.direction}</span>
                <a href={l.asset.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">{l.asset.name} ↗</a>
                <span className="text-xs text-slate-400"> · {l.asset.type}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="card p-4">
        <SectionTitle>Comments</SectionTitle>
        <div className="mb-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar name={c.author.name} color={c.author.avatarColor} size={6} />
              <div>
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-600">{c.author.name}</span> · {fmtDateTime(c.createdAt)}
                </p>
                <p className="text-sm text-slate-700">{c.body}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
        </div>
        <CommentBox entityType="task" entityId={task.id} />
      </div>

      {/* Immutable activity timeline */}
      <div className="card p-4">
        <SectionTitle>Activity — immutable, timestamped</SectionTitle>
        <ol className="space-y-2 border-l-2 border-slate-100 pl-4">
          {activity.map((a) => (
            <li key={a.id} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${a.actorId ? "bg-slate-300" : "bg-amber-400"}`} />
              <p className="text-sm">
                <span className={`font-semibold ${a.actorId ? "text-slate-700" : "text-amber-700"}`}>{a.actorId ? a.actorName : "SYSTEM"}</span>{" "}
                {a.action.replace(/[._]/g, " ")}
                {a.fromValue && a.toValue && (
                  <span className="text-slate-500"> · {fmtIfDate(a.fromValue)} → {fmtIfDate(a.toValue)}</span>
                )}
                {!a.fromValue && a.toValue && <span className="text-slate-500"> · {fmtIfDate(a.toValue)}</span>}
              </p>
              {a.meta && metaReason(a.meta) && <p className="text-xs text-slate-500">Reason: {metaReason(a.meta)}</p>}
              <p className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function fmtIfDate(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(new Date(v));
  return v.length > 60 ? v.slice(0, 57) + "…" : v;
}

function metaReason(meta: string): string | null {
  try {
    const parsed = JSON.parse(meta);
    return parsed.reason ?? null;
  } catch {
    return null;
  }
}
