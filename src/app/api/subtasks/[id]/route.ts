import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const PATCH = withUser(async (req, _user, params) => {
  const input = await body<{ done: boolean }>(req);
  const subtask = await db.subtask.findUnique({ where: { id: params.id } });
  if (!subtask) throw new ValidationError("Subtask not found.");
  await db.subtask.update({ where: { id: params.id }, data: { done: !!input.done } });
  return ok();
});
