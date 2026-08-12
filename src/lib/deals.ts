import { db } from "./db";
import { logActivity } from "./activity";
import { createProject } from "./projects";
import { ValidationError } from "./tasks";
import { SERVICE_DEAL_STAGES, BRAND_DEAL_STAGES } from "./constants";
import type { SessionUser } from "./auth";

// CRM: two pipelines. Won service deals convert one-click into
// Client + Project from a template; Signed brand deals auto-create a
// fulfillment project. Nothing re-typed.

export async function moveDealStage(actor: SessionUser, dealId: string, stage: string) {
  const deal = await db.deal.findFirst({ where: { id: dealId, archivedAt: null } });
  if (!deal) throw new ValidationError("Deal not found.");
  const allowed = deal.kind === "service" ? SERVICE_DEAL_STAGES : BRAND_DEAL_STAGES;
  if (!allowed.includes(stage as never)) throw new ValidationError(`Invalid stage "${stage}" for a ${deal.kind} deal.`);
  if (stage === deal.stage) return deal;

  const updated = await db.deal.update({
    where: { id: dealId },
    data: { stage, lastActivityAt: new Date() },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "deal",
    entityId: dealId,
    action: "stage_moved",
    fromValue: deal.stage,
    toValue: stage,
    clientId: deal.clientId,
  });
  return updated;
}

export interface ConvertServiceDealInput {
  dealId: string;
  templateId: string;
  projectName?: string;
  ownerId: string; // PM for the new project
  divisionId?: string; // required when the deal has no client yet
  startDate?: string;
}

// Service deal Won -> Client (created if prospect) + Project from template,
// carrying value, contact, scope notes (spec journey #2).
export async function convertServiceDeal(actor: SessionUser, input: ConvertServiceDealInput) {
  const deal = await db.deal.findFirst({ where: { id: input.dealId, archivedAt: null } });
  if (!deal) throw new ValidationError("Deal not found.");
  if (deal.kind !== "service") throw new ValidationError("Only service deals convert this way.");
  if (deal.convertedProjectId) throw new ValidationError("Deal already converted.");

  let clientId = deal.clientId;
  if (!clientId) {
    if (!input.divisionId) throw new ValidationError("Pick a division for the new client.");
    const name = deal.prospectName || deal.name;
    const client = await db.client.create({
      data: {
        divisionId: input.divisionId,
        name,
        slug: await uniqueSlug(name),
        kind: "external",
        contactName: deal.contactName,
        contactEmail: deal.contactEmail,
        notes: deal.notes,
      },
    });
    await db.brandKit.create({ data: { clientId: client.id } });
    clientId = client.id;
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      entityType: "client",
      entityId: client.id,
      action: "created",
      toValue: client.name,
      meta: { fromDeal: deal.id },
      clientId: client.id,
    });
  }

  const project = await createProject(actor, {
    name: input.projectName || deal.name,
    clientId,
    ownerId: input.ownerId,
    value: deal.value,
    templateId: input.templateId,
    startDate: input.startDate,
    notes: deal.notes || undefined,
    defaultAssigneeId: input.ownerId,
  });

  await db.deal.update({
    where: { id: deal.id },
    data: { stage: "won", clientId, convertedProjectId: project.id, lastActivityAt: new Date() },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "deal",
    entityId: deal.id,
    action: "converted",
    toValue: project.name,
    meta: { projectId: project.id, clientId },
    clientId,
    projectId: project.id,
  });
  return { projectId: project.id, clientId };
}

// Brand deal Signed -> fulfillment project on the internal client (spec journey #7).
export async function convertBrandDeal(actor: SessionUser, dealId: string, ownerId: string, templateId: string) {
  const deal = await db.deal.findFirst({ where: { id: dealId, archivedAt: null } });
  if (!deal) throw new ValidationError("Deal not found.");
  if (deal.kind !== "brand") throw new ValidationError("Not a brand deal.");
  if (!deal.clientId) throw new ValidationError("Brand deals must be attached to an internal brand/client.");
  if (deal.convertedProjectId) throw new ValidationError("Deal already converted.");

  const project = await createProject(actor, {
    name: `${deal.name} — fulfillment`,
    clientId: deal.clientId,
    ownerId,
    value: deal.value,
    templateId,
    notes: deal.notes || undefined,
    defaultAssigneeId: ownerId,
  });
  await db.deal.update({
    where: { id: dealId },
    data: { stage: "signed", convertedProjectId: project.id, lastActivityAt: new Date() },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "deal",
    entityId: dealId,
    action: "converted",
    toValue: project.name,
    meta: { projectId: project.id },
    clientId: deal.clientId,
    projectId: project.id,
  });
  return { projectId: project.id };
}

async function uniqueSlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  let slug = base;
  let n = 1;
  while (await db.client.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

export { uniqueSlug };
