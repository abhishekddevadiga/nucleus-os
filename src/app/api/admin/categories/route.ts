import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ name: string }>(req);

  if (!input.name?.trim()) throw new ValidationError("Category name required.");

  const key = input.name.toLowerCase().replace(/\s+/g, "_");
  const created = await db.assetCategory.create({
    data: {
      name: input.name.trim(),
      key,
    },
  });

  return ok({ id: created.id });
});
