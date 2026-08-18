import { db } from "./db";
import type { SessionUser } from "./auth";

// Role-scope resolution. Roles are assigned per scope; visibility:
//  - Owner: everything
//  - Lead: businesses/projects they lead — full view inside scope
//  - Member: projects where they hold tasks, watch tasks, or are members

export async function getVisibleBusinessIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.isOwner) return "all";

  const ids = new Set<string>();

  const leadBusinessIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "business").map((r) => r.scopeId);
  const leadCampaignIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "campaign").map((r) => r.scopeId);
  const orgLead = user.roles.some((r) => r.role === "lead" && r.scopeType === "organization");
  if (orgLead) return "all";

  if (leadBusinessIds.length) {
    leadBusinessIds.forEach((id) => ids.add(id));
  }

  // Businesses from projects they lead or are members of
  if (leadCampaignIds.length) {
    const projects = await db.campaign.findMany({
      where: { id: { in: leadCampaignIds } },
      select: { businessId: true },
      distinct: ["businessId"],
    });
    projects.forEach((p) => ids.add(p.businessId));
  }

  // Businesses from projects where they're a member or have tasks
  const [memberships, taskCampaigns] = await Promise.all([
    db.campaignMember.findMany({ where: { userId: user.id }, select: { campaign: { select: { businessId: true } } } }),
    db.taskBusiness.findMany({
      where: { task: { assigneeId: user.id, archivedAt: null } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
  ]);
  memberships.forEach((m) => ids.add(m.campaign.businessId));
  taskCampaigns.forEach((t) => ids.add(t.businessId));

  return [...ids];
}

export async function getVisibleCampaignIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.isOwner) return "all";

  const ids = new Set<string>();

  const leadBusinessIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "business").map((r) => r.scopeId);
  const leadCampaignIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "campaign").map((r) => r.scopeId);
  const orgLead = user.roles.some((r) => r.role === "lead" && r.scopeType === "organization");
  if (orgLead) return "all";

  if (leadBusinessIds.length) {
    const projects = await db.campaign.findMany({
      where: { businessId: { in: leadBusinessIds } },
      select: { id: true },
    });
    projects.forEach((p) => ids.add(p.id));
  }
  leadCampaignIds.forEach((id) => ids.add(id));

  // membership + own/watched tasks
  const [memberships, taskCampaigns, owned] = await Promise.all([
    db.campaignMember.findMany({ where: { userId: user.id }, select: { campaignId: true } }),
    db.task.findMany({
      where: { OR: [{ assigneeId: user.id }, { watchers: { some: { userId: user.id } } }], archivedAt: null },
      select: { campaignId: true },
      distinct: ["campaignId"],
    }),
    db.campaign.findMany({ where: { ownerId: user.id }, select: { id: true } }),
  ]);
  memberships.forEach((m) => ids.add(m.campaignId));
  taskCampaigns.forEach((t) => ids.add(t.campaignId));
  owned.forEach((p) => ids.add(p.id));

  return [...ids];
}

export async function canSeeProject(user: SessionUser, campaignId: string): Promise<boolean> {
  const visible = await getVisibleCampaignIds(user);
  return visible === "all" || visible.includes(campaignId);
}

export function projectWhere(visible: string[] | "all") {
  return visible === "all" ? {} : { id: { in: visible } };
}

export function taskProjectWhere(visible: string[] | "all") {
  return visible === "all" ? {} : { campaignId: { in: visible } };
}

// Leads for a given campaign: the PM + leads scoped to the project/business + Owner.
export async function getProjectManagers(campaignId: string): Promise<string[]> {
  const project = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { business: true },
  });
  if (!project) return [];
  const assignments = await db.roleAssignment.findMany({
    where: {
      role: "lead",
      OR: [
        { scopeType: "campaign", scopeId: campaignId },
        { scopeType: "business", scopeId: project.businessId },
      ],
    },
    select: { userId: true },
  });
  return [...new Set([project.ownerId, ...assignments.map((a) => a.userId)])];
}

export async function getOwnerUserIds(): Promise<string[]> {
  const assignments = await db.roleAssignment.findMany({
    where: { role: "owner" },
    select: { userId: true },
  });
  return [...new Set(assignments.map((a) => a.userId))];
}

// Lead check used by approval flows: lead of project/business, or owner.
export async function canManageProject(user: SessionUser, campaignId: string): Promise<boolean> {
  if (user.isOwner) return true;
  const managers = await getProjectManagers(campaignId);
  return managers.includes(user.id);
}
