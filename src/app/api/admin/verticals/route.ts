import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

// Custom vertical builder: name + ordered stages,
// creatable in-app with no code change. CEO/Admin only.
export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ name: string; stages: string[] | Record<string, string> }>(req);
  if (!input.name?.trim()) throw new ValidationError("Vertical name required.");
  // Indexed form field names post as {"0": "...", "1": "..."} — normalize.
  const rawStages = Array.isArray(input.stages) ? input.stages : Object.values(input.stages ?? {});
  const stages = rawStages.map((s) => String(s).trim()).filter(Boolean);
  if (stages.length < 2) throw new ValidationError("A vertical needs at least 2 pipeline stages.");

  const company = await db.company.findFirst();
  if (!company) throw new ValidationError("Company missing.");
  const slugBase = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = slugBase;
  let n = 1;
  while (await db.vertical.findUnique({ where: { slug } })) slug = `${slugBase}-${++n}`;

  const maxOrder = await db.vertical.count();
  const vertical = await db.vertical.create({
    data: {
      companyId: company.id,
      name: input.name.trim(),
      slug,
      sortOrder: maxOrder,
      stages: {
        create: stages.map((name, idx) => ({ name, sortOrder: idx, isTerminal: idx === stages.length - 1 })),
      },
    },
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "vertical", entityId: vertical.id,
    action: "created", toValue: vertical.name, meta: { stages },
  });
  return ok({ id: vertical.id });
});
