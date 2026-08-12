import { withUser, ok, body } from "@/lib/api";
import { requestExtension } from "@/lib/tasks";

export const POST = withUser(async (req, user, params) => {
  const input = await body<{ requestedDate: string; reason: string }>(req);
  await requestExtension(user, params.id, input.requestedDate, input.reason);
  return ok();
});
