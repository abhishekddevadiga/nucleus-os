import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ name: string }>(req);

  if (!input.name?.trim()) throw new ValidationError("Department name required.");

  const slug = input.name.toLowerCase().replace(/\s+/g, "-");
  const created = await db.department.create({
    data: {
      name: input.name.trim(),
      slug,
    },
  });

  return ok({ id: created.id });
});
