import { withUser, ok, body } from "@/lib/api";
import { createTask, type CreateTaskInput } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  const input = await body<CreateTaskInput>(req);
  const task = await createTask(user, input);
  return ok({ id: task.id });
});
