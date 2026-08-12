import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { uniqueSlug } from "@/lib/deals";
import { ValidationError, ForbiddenError } from "@/lib/tasks";
import { CLIENT_KINDS } from "@/lib/constants";

// "+ Add internal client" is how a new business launches.
export const POST = withUser(async (req, user) => {
  if (!user.isCeo && !user.isLead && !user.isSales) {
    throw new ForbiddenError("Only CEO/Ops, leads or sales can add clients.");
  }
  const input = await body<{ name: string; divisionId: string; kind: string; contactName?: string; contactEmail?: string; notes?: string }>(req);
  if (!input.name?.trim()) throw new ValidationError("Client name required.");
  if (!CLIENT_KINDS.includes(input.kind as never)) throw new ValidationError("Kind must be internal or external.");
  const division = await db.division.findFirst({ where: { id: input.divisionId, archivedAt: null } });
  if (!division) throw new ValidationError("Division not found.");

  const client = await db.client.create({
    data: {
      divisionId: input.divisionId,
      name: input.name.trim(),
      slug: await uniqueSlug(input.name),
      kind: input.kind,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      notes: input.notes?.trim() || null,
      brandKit: { create: {} }, // full machinery from day one
    },
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "client", entityId: client.id,
    action: "created", toValue: client.name,
    meta: { kind: input.kind, division: division.name },
    clientId: client.id,
  });
  return ok({ id: client.id, slug: client.slug });
});
