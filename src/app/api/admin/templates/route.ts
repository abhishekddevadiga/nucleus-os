import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

// Create or update a campaign template. Config is validated JSON with the
// TemplateConfig shape (verticals, milestones, tasks with relative deadlines).
export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{ id?: string; name: string; description?: string; config: string }>(req);
  if (!input.name?.trim()) throw new ValidationError("Template name required.");
  let parsed: { verticals?: unknown; milestones?: unknown; tasks?: unknown };
  try {
    parsed = JSON.parse(input.config);
  } catch {
    throw new ValidationError("Config must be valid JSON.");
  }
  if (!Array.isArray(parsed.verticals)) throw new ValidationError('Config needs a "verticals" array of slugs.');

  if (input.id) {
    const existing = await db.campaignTemplate.findUnique({ where: { id: input.id } });
    if (!existing) throw new ValidationError("Template not found.");
    await db.campaignTemplate.update({
      where: { id: input.id },
      data: { name: input.name.trim(), description: input.description?.trim() || null, config: input.config },
    });
    await logActivity({ actorId: user.id, actorName: user.name, entityType: "template", entityId: input.id, action: "updated", toValue: input.name });
    return ok({ id: input.id });
  }

  const key = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let unique = key;
  let n = 1;
  while (await db.campaignTemplate.findUnique({ where: { key: unique } })) unique = `${key}-${++n}`;
  const created = await db.campaignTemplate.create({
    data: { key: unique, name: input.name.trim(), description: input.description?.trim() || null, config: input.config },
  });
  await logActivity({ actorId: user.id, actorName: user.name, entityType: "template", entityId: created.id, action: "created", toValue: created.name });
  return ok({ id: created.id });
});
