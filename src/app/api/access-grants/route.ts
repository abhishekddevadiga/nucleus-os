import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  const input = await body<{ clientId: string; userId: string; property: string; notes?: string; revokeId?: string }>(req);

  if (input.revokeId) {
    const grant = await db.accessGrant.findUnique({ where: { id: input.revokeId } });
    if (!grant) throw new ValidationError("Grant not found.");
    await db.accessGrant.update({ where: { id: input.revokeId }, data: { revokedAt: new Date() } });
    await logActivity({
      actorId: user.id, actorName: user.name,
      entityType: "access_grant", entityId: input.revokeId,
      action: "revoked", toValue: grant.property, clientId: grant.clientId,
    });
    return ok();
  }

  if (!input.property?.trim()) throw new ValidationError("Property name required (e.g. 'Meta Ads account').");
  const grant = await db.accessGrant.create({
    data: { clientId: input.clientId, userId: input.userId, property: input.property.trim(), notes: input.notes?.trim() || null },
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "access_grant", entityId: grant.id,
    action: "granted", toValue: input.property, clientId: input.clientId,
  });
  return ok({ id: grant.id });
});
