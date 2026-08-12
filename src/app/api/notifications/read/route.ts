import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = withUser(async (req, user) => {
  const input = await body<{ ids?: string[]; all?: boolean }>(req);
  await db.notification.updateMany({
    where: {
      userId: user.id, // only your own
      readAt: null,
      ...(input.all ? {} : { id: { in: input.ids ?? [] } }),
    },
    data: { readAt: new Date() },
  });
  return ok();
});
