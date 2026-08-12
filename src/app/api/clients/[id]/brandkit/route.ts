import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

export const PATCH = withUser(async (req, user, params) => {
  const client = await db.client.findFirst({ where: { id: params.id, archivedAt: null } });
  if (!client) throw new ValidationError("Client not found.");
  const input = await body<{ logoUrl?: string; colors?: string; fonts?: string; toneOfVoiceUrl?: string; dosAndDonts?: string; notes?: string }>(req);

  await db.brandKit.upsert({
    where: { clientId: params.id },
    create: { clientId: params.id, ...sanitize(input) },
    update: sanitize(input),
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "client", entityId: params.id,
    action: "brandkit_updated",
    clientId: params.id,
  });
  return ok();
});

function sanitize(input: Record<string, string | undefined>) {
  const out: Record<string, string | null> = {};
  for (const key of ["logoUrl", "colors", "fonts", "toneOfVoiceUrl", "dosAndDonts", "notes"]) {
    if (input[key] !== undefined) out[key] = input[key]?.trim() || null;
  }
  return out;
}
