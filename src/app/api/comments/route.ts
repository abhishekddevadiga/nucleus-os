import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

const COMMENTABLE = ["task", "deal", "project"];

export const POST = withUser(async (req, user) => {
  const input = await body<{ entityType: string; entityId: string; body: string }>(req);
  if (!COMMENTABLE.includes(input.entityType)) throw new ValidationError("Cannot comment on that.");
  if (!input.body?.trim()) throw new ValidationError("Comment cannot be empty.");

  let projectId: string | null = null;
  let clientId: string | null = null;
  let taskId: string | null = null;
  if (input.entityType === "task") {
    const task = await db.task.findUnique({ where: { id: input.entityId }, include: { project: true } });
    if (!task) throw new ValidationError("Task not found.");
    projectId = task.projectId;
    clientId = task.project.clientId;
    taskId = task.id;
  } else if (input.entityType === "deal") {
    const deal = await db.deal.findUnique({ where: { id: input.entityId } });
    if (!deal) throw new ValidationError("Deal not found.");
    clientId = deal.clientId;
    // Commenting on a deal counts as activity (stale-deal detection).
    await db.deal.update({ where: { id: deal.id }, data: { lastActivityAt: new Date() } });
  } else {
    const project = await db.project.findUnique({ where: { id: input.entityId } });
    if (!project) throw new ValidationError("Project not found.");
    projectId = project.id;
    clientId = project.clientId;
  }

  const comment = await db.comment.create({
    data: { entityType: input.entityType, entityId: input.entityId, authorId: user.id, body: input.body.trim() },
  });
  await logActivity({
    actorId: user.id,
    actorName: user.name,
    entityType: input.entityType,
    entityId: input.entityId,
    action: "commented",
    toValue: input.body.trim().slice(0, 140),
    projectId,
    clientId,
    taskId,
  });
  return ok({ id: comment.id });
});
