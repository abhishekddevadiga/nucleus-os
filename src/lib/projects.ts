import { db } from "./db";
import { logActivity } from "./activity";
import { ValidationError } from "./tasks";
import type { SessionUser } from "./auth";

export interface CreateProjectInput {
  name: string;
  businessId: string;
  ownerId: string;
  startDate?: string | Date;
  templateId?: string;
  notes?: string;
}

export async function createProject(actor: SessionUser, input: CreateProjectInput) {
  if (!input.name?.trim()) throw new ValidationError("Pcampaign name is required.");
  const business = await db.business.findFirst({ where: { id: input.businessId, archivedAt: null } });
  if (!business) throw new ValidationError("Business not found.");
  const owner = await db.user.findFirst({ where: { id: input.ownerId, archivedAt: null } });
  if (!owner) throw new ValidationError("Pcampaign owner (PM) is required.");
  const start = input.startDate ? new Date(input.startDate) : new Date();
  if (isNaN(start.getTime())) throw new ValidationError("Invalid start date.");

  const project = await db.campaign.create({
    data: {
      name: input.name.trim(),
      businessId: input.businessId,
      ownerId: input.ownerId,
      startDate: start,
      templateId: input.templateId ?? null,
      notes: input.notes?.trim() || null,
    },
  });

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "campaign",
    entityId: project.id,
    action: "created",
    toValue: project.name,
    campaignId: project.id,
    businessId: business.id,
  });
  return project;
}

export type Health = "on_track" | "at_risk" | "delayed";

export function computeHealth(input: {
  overdueCount: number;
  slippedMilestones: number;
  dueSoonUntouched: number;
}): Health {
  if (input.overdueCount > 0 || input.slippedMilestones > 0) return "delayed";
  if (input.dueSoonUntouched > 0) return "at_risk";
  return "on_track";
}

export async function getProjectHealth(campaignId: string): Promise<Health> {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const [overdueCount, slippedMilestones, dueSoon] = await Promise.all([
    db.task.count({ where: { campaignId, archivedAt: null, completedAt: null, dueDate: { lt: now } } }),
    db.milestone.count({ where: { campaignId, archivedAt: null, status: "pending", dueDate: { lt: now } } }),
    db.task.findMany({
      where: { campaignId, archivedAt: null, completedAt: null, dueDate: { gte: now, lt: soon } },
      include: { stage: true, workstream: { include: { stages: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
    }),
  ]);
  const dueSoonUntouched = dueSoon.filter((t) => t.workstream.stages[0]?.id === t.stageId).length;
  return computeHealth({ overdueCount, slippedMilestones, dueSoonUntouched });
}

export async function archiveProject(actor: SessionUser, campaignId: string) {
  const project = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!project) throw new ValidationError("Pcampaign not found.");
  const updated = await db.campaign.update({
    where: { id: campaignId },
    data: { archivedAt: new Date(), status: "archived" },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "campaign",
    entityId: campaignId,
    action: "archived",
    campaignId,
    businessId: project.businessId,
  });
  return updated;
}
