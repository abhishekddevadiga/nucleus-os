import { withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { getVisibleCampaignIds, taskProjectWhere } from "@/lib/permissions";
import { BRAND } from "@/lib/brand";

// CSV export of the task sheet. Same filters as the Reports page:
// ?userId= &campaignId= &businessId= &from= &to=
export const GET = withUser(async (req, user) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const campaignId = url.searchParams.get("campaignId") || undefined;
  const businessId = url.searchParams.get("businessId") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const visible = await getVisibleCampaignIds(user);
  const tasks = await db.task.findMany({
    where: {
      ...taskProjectWhere(visible),
      archivedAt: null,
      ...(userId ? { assigneeId: userId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(businessId ? { campaign: { businessId } } : {}),
      ...(from || to
        ? { dueDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } }
        : {}),
    },
    include: {
      assignee: true,
      campaign: { include: { business: true } },
      workstream: true,
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
    "Task", "Type", "Division", "Client", "Pcampaign", "Vertical", "Stage", "Assignee",
    "Priority", "Estimate (h)", "Due date", "Original due", "Status", "Days in stage", "Escalation level",
  ];
  const lines = [header.join(",")];
  for (const t of tasks) {
    const inStageMs = now - (lastMove.get(t.id) ?? t.createdAt).getTime();
    lines.push(
      [
        esc(t.title),
        t.isTicket ? `ticket (${t.ticketType})` : "task",
        esc(""),
        esc(t.campaign.business.name),
        esc(t.campaign.name),
        esc(t.workstream.name),
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
