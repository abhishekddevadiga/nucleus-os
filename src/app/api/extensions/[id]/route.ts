import { withUser, ok, body } from "@/lib/api";
import { decideExtension } from "@/lib/tasks";

export const POST = withUser(async (req, user, params) => {
  const input = await body<{ approve: boolean; note?: string }>(req);
  await decideExtension(user, params.id, !!input.approve, input.note);
  return ok();
});
