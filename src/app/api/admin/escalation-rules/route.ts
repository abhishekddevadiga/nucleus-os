import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ offsetHours: number; action: string; level: number }>(req);

  if (!input.offsetHours && input.offsetHours !== 0) throw new ValidationError("Offset hours required.");
  if (!input.action?.trim()) throw new ValidationError("Action required.");
  if (!input.level) throw new ValidationError("Level required.");

  const created = await db.escalationRule.create({
    data: {
      offsetHours: input.offsetHours,
      action: input.action,
      level: input.level,
      scopeType: "organization",
      scopeId: "org",
    },
  });

  return ok({ id: created.id });
});
