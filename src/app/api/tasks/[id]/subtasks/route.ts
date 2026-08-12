import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user, params) => {
  const input = await body<{ title: string }>(req);
  if (!input.title?.trim()) throw new ValidationError("Subtask title required.");
  const task = await db.task.findFirst({ where: { id: params.id, archivedAt: null } });
  if (!task) throw new ValidationError("Task not found.");
  const subtask = await db.subtask.create({ data: { taskId: params.id, title: input.title.trim() } });
  return ok({ id: subtask.id });
});
