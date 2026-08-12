import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { moveTaskStage, reassignTask, ValidationError, ForbiddenError } from "@/lib/tasks";
import { canManageProject } from "@/lib/permissions";
import { PRIORITIES } from "@/lib/constants";

// PATCH /api/tasks/:id — stage move, reassignment, property edits, archive.
// Deadline changes have their own endpoint with mandatory reason.
export const PATCH = withUser(async (req, user, params) => {
  const input = await body<{
    stageId?: string;
    assigneeId?: string;
    title?: string;
    description?: string;
    priority?: string;
    estimateHours?: number;
    tags?: string;
    archive?: boolean;
  }>(req);

  if (input.stageId) await moveTaskStage(user, params.id, input.stageId);
  if (input.assigneeId) await reassignTask(user, params.id, input.assigneeId);

  const fields: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ValidationError("Title cannot be empty.");
    fields.title = input.title.trim();
  }
  if (input.description !== undefined) fields.description = input.description.trim() || null;
  if (input.priority !== undefined) {
    if (!PRIORITIES.includes(input.priority as never)) throw new ValidationError("Invalid priority.");
    fields.priority = input.priority;
  }
  if (input.estimateHours !== undefined) fields.estimateHours = Math.max(0, Number(input.estimateHours) || 0);
  if (input.tags !== undefined) fields.tags = input.tags.trim() || null;

  if (input.archive) {
    const task = await db.task.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!task) throw new ValidationError("Task not found.");
    if (!(await canManageProject(user, task.projectId))) {
      throw new ForbiddenError("Only the PM or CEO can archive tasks.");
    }
    fields.archivedAt = new Date();
  }

  if (Object.keys(fields).length) {
    const before = await db.task.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!before) throw new ValidationError("Task not found.");
    await db.task.update({ where: { id: params.id }, data: fields });
    await logActivity({
      actorId: user.id,
      actorName: user.name,
      entityType: before.isTicket ? "ticket" : "task",
      entityId: params.id,
      action: input.archive ? "archived" : "updated",
      meta: { fields: Object.keys(fields) },
      projectId: before.projectId,
      clientId: before.project.clientId,
      taskId: params.id,
    });
  }
  return ok();
});
