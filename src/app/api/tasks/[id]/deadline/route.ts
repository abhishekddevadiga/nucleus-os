import { withUser, ok, body } from "@/lib/api";
import { changeDueDate } from "@/lib/tasks";

export const POST = withUser(async (req, user, params) => {
  const input = await body<{ dueDate: string; reason: string }>(req);
  await changeDueDate(user, params.id, input.dueDate, input.reason);
  return ok();
});
