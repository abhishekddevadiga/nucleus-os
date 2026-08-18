import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ name: string; stages: string[] }>(req);

  if (!input.name?.trim()) throw new ValidationError("Workstream name required.");
  if (!input.stages || input.stages.length === 0) throw new ValidationError("At least one stage required.");

  const slug = input.name.toLowerCase().replace(/\s+/g, "-");
  
  const created = await db.workstream.create({
    data: {
      name: input.name.trim(),
      slug,
      businessId: "org",
      stages: {
        create: input.stages.map((stageName, idx) => ({
          name: stageName,
          sortOrder: idx,
        })),
      },
    },
  });

  return ok({ id: created.id });
});
