import { withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getVisibleProjectIds, taskProjectWhere } from "@/lib/permissions";
import { BRAND } from "@/lib/brand";

// CSV export of the task sheet. Same filters as the Reports page:
// ?userId= &projectId= &clientId= &from= &to=
export const GET = withUser(async (req, user) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const clientId = url.searchParams.get("clientId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const visible = await getVisibleProjectIds(user);
  const tasks = await db.task.findMany({
    where: {
      ...taskProjectWhere(visible),
      archivedAt: null,
      ...(userId ? { assigneeId: userId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(clientId ? { project: { clientId } } : {}),
      ...(from || to
        ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } }
        : {}),
    },
    include: {
      assignee: true,
      project: { include: { client: { include: { division: true } } } },
      vertical: true,
      stage: true,
    },
    orderBy: { dueDate: "asc" },
  });

  // Time-in-stage from the activity log (last stage_moved, else created).
  const logRows = await db.activityLog.findMany({
    where: { taskId: { in: tasks.map((t) => t.id) }, action: { in: ["stage_moved", "created"] } },
    orderBy: { createdAt: "asc" },
  });
  const lastMove = new Map<string, Date>();
  for (const row of logRows) if (row.taskId) lastMove.set(row.taskId, row.createdAt);

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const now = Date.now();
  const header = [
    "Task", "Type", "Division", "Client", "Project", "Vertical", "Stage", "Assignee",
    "Priority", "Estimate (h)", "Due date", "Original due", "Status", "Days in stage", "Escalation level",
  ];
  const lines = [header.join(",")];
  for (const t of tasks) {
    const inStageMs = now - (lastMove.get(t.id) ?? t.createdAt).getTime();
    lines.push(
      [
        esc(t.title),
        t.isTicket ? `ticket (${t.ticketType})` : "task",
        esc(t.project.client.division.name),
        esc(t.project.client.name),
        esc(t.project.name),
        esc(t.vertical.name),
        esc(t.stage.name),
        esc(t.assignee.name),
        t.priority,
        t.estimateHours,
        t.dueDate.toISOString().slice(0, 10),
        t.originalDueDate.toISOString().slice(0, 10),
        t.completedAt ? "done" : t.dueDate < new Date() ? "OVERDUE" : "open",
        (inStageMs / 86400000).toFixed(1),
        t.escalationLevel,
      ].join(",")
    );
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${BRAND.slug}-task-sheet-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
