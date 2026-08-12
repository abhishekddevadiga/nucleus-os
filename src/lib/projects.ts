import { db } from "./db";
import { logActivity } from "./activity";
import { ValidationError } from "./tasks";
import type { TemplateConfig } from "./constants";
import type { SessionUser } from "./auth";

// Project creation — manual or from a template. Templates
// pre-attach verticals, milestones, and task lists with deadlines relative to
// the project start date.

export interface CreateProjectInput {
  name: string;
  clientId: string;
  ownerId: string;
  value?: number;
  startDate?: string | Date;
  templateId?: string;
  notes?: string;
  defaultAssigneeId?: string; // who templated tasks land on until the PM reassigns
  verticalIds?: string[] | string; // manual creation: which verticals to attach
}

export async function createProject(actor: SessionUser, input: CreateProjectInput) {
  if (!input.name?.trim()) throw new ValidationError("Project name is required.");
  const client = await db.client.findFirst({ where: { id: input.clientId, archivedAt: null } });
  if (!client) throw new ValidationError("Client not found.");
  const owner = await db.user.findFirst({ where: { id: input.ownerId, archivedAt: null } });
  if (!owner) throw new ValidationError("Project owner (PM) is required.");
  const start = input.startDate ? new Date(input.startDate) : new Date();
  if (isNaN(start.getTime())) throw new ValidationError("Invalid start date.");

  let template: { id: string; name: string; config: TemplateConfig } | null = null;
  if (input.templateId) {
    const row = await db.projectTemplate.findFirst({ where: { id: input.templateId, archivedAt: null } });
    if (!row) throw new ValidationError("Template not found.");
    template = { id: row.id, name: row.name, config: JSON.parse(row.config) as TemplateConfig };
  }

  const project = await db.project.create({
    data: {
      name: input.name.trim(),
      clientId: input.clientId,
      ownerId: input.ownerId,
      value: input.value ?? 0,
      startDate: start,
      templateId: template?.id ?? null,
      notes: input.notes?.trim() || null,
    },
  });

  const day = 24 * 3600 * 1000;
  const at = (offsetDays: number) => {
    const d = new Date(start.getTime() + offsetDays * day);
    d.setHours(18, 0, 0, 0); // deadlines default to 6pm local
    return d;
  };

  // Attach verticals
  const verticalSlugs = template ? template.config.verticals : null;
  let verticals: { id: string; slug: string }[] = [];
  if (verticalSlugs?.length) {
    verticals = await db.vertical.findMany({ where: { slug: { in: verticalSlugs }, archivedAt: null }, select: { id: true, slug: true } });
  } else if (input.verticalIds?.length) {
    // Tolerate a single id posted as a plain string.
    const ids = Array.isArray(input.verticalIds) ? input.verticalIds : [input.verticalIds];
    verticals = await db.vertical.findMany({ where: { id: { in: ids }, archivedAt: null }, select: { id: true, slug: true } });
  }
  if (verticals.length) {
    await db.projectVertical.createMany({
      data: verticals.map((v) => ({ projectId: project.id, verticalId: v.id })),
    });
  }

  // Milestones + templated tasks (relative deadlines)
  if (template) {
    const cfg = template.config;
    for (const m of cfg.milestones ?? []) {
      await db.milestone.create({
        data: {
          projectId: project.id,
          title: m.title,
          dueDate: at(m.offsetDays),
          billable: m.billable,
          amount: m.amountPct ? Math.round(((input.value ?? 0) * m.amountPct) / 100) : 0,
        },
      });
    }
    const bySlug = new Map(verticals.map((v) => [v.slug, v.id]));
    const assignee = input.defaultAssigneeId ?? input.ownerId;
    for (const t of cfg.tasks ?? []) {
      const verticalId = bySlug.get(t.vertical);
      if (!verticalId) continue;
      const firstStage = await db.pipelineStage.findFirst({
        where: { verticalId, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      if (!firstStage) continue;
      const dueDate = at(t.offsetDays);
      const task = await db.task.create({
        data: {
          title: t.title,
          projectId: project.id,
          verticalId,
          stageId: firstStage.id,
          assigneeId: assignee,
          creatorId: actor.id,
          dueDate,
          originalDueDate: dueDate,
          priority: t.priority,
          estimateHours: t.estimateHours,
        },
      });
      await logActivity({
        actorId: actor.id,
        actorName: actor.name,
        entityType: "task",
        entityId: task.id,
        action: "created",
        toValue: firstStage.name,
        meta: { fromTemplate: template.name },
        projectId: project.id,
        clientId: client.id,
        taskId: task.id,
      });
    }
  }

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: project.id,
    action: "created",
    toValue: project.name,
    meta: { template: template?.name ?? null, clientId: client.id },
    projectId: project.id,
    clientId: client.id,
  });
  return project;
}

// Project health: derived, never self-reported.
//  Delayed  — any overdue task, or a milestone past due and incomplete
//  At risk  — anything due within 48h that hasn't moved past its first stage
//  On track — otherwise
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

export async function getProjectHealth(projectId: string): Promise<Health> {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const [overdueCount, slippedMilestones, dueSoon] = await Promise.all([
    db.task.count({ where: { projectId, archivedAt: null, completedAt: null, dueDate: { lt: now } } }),
    db.milestone.count({ where: { projectId, archivedAt: null, status: "pending", dueDate: { lt: now } } }),
    db.task.findMany({
      where: { projectId, archivedAt: null, completedAt: null, dueDate: { gte: now, lt: soon } },
      include: { stage: true, vertical: { include: { stages: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
    }),
  ]);
  const dueSoonUntouched = dueSoon.filter((t) => t.vertical.stages[0]?.id === t.stageId).length;
  return computeHealth({ overdueCount, slippedMilestones, dueSoonUntouched });
}

export async function archiveProject(actor: SessionUser, projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ValidationError("Project not found.");
  const updated = await db.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date(), status: "archived" },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "project",
    entityId: projectId,
    action: "archived",
    projectId,
    clientId: project.clientId,
  });
  return updated;
}
