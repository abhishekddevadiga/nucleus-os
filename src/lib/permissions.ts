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
  const leadProjectIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "project").map((r) => r.scopeId);
  const orgLead = user.roles.some((r) => r.role === "lead" && r.scopeType === "organization");
  if (orgLead) return "all";

  if (leadBusinessIds.length) {
    leadBusinessIds.forEach((id) => ids.add(id));
  }

  // Businesses from projects they lead or are members of
  if (leadProjectIds.length) {
    const projects = await db.project.findMany({
      where: { id: { in: leadProjectIds } },
      select: { businessId: true },
      distinct: ["businessId"],
    });
    projects.forEach((p) => ids.add(p.businessId));
  }

  // Businesses from projects where they're a member or have tasks
  const [memberships, taskProjects] = await Promise.all([
    db.projectMember.findMany({ where: { userId: user.id }, select: { project: { select: { businessId: true } } } }),
    db.taskBusiness.findMany({
      where: { task: { assigneeId: user.id, archivedAt: null } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
  ]);
  memberships.forEach((m) => ids.add(m.project.businessId));
  taskProjects.forEach((t) => ids.add(t.businessId));

  return [...ids];
}

export async function getVisibleProjectIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.isOwner) return "all";

  const ids = new Set<string>();

  const leadBusinessIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "business").map((r) => r.scopeId);
  const leadProjectIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "project").map((r) => r.scopeId);
  const orgLead = user.roles.some((r) => r.role === "lead" && r.scopeType === "organization");
  if (orgLead) return "all";

  if (leadBusinessIds.length) {
    const projects = await db.project.findMany({
      where: { businessId: { in: leadBusinessIds } },
      select: { id: true },
    });
    projects.forEach((p) => ids.add(p.id));
  }
  leadProjectIds.forEach((id) => ids.add(id));

  // membership + own/watched tasks
  const [memberships, taskProjects, owned] = await Promise.all([
    db.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } }),
    db.task.findMany({
      where: { OR: [{ assigneeId: user.id }, { watchers: { some: { userId: user.id } } }], archivedAt: null },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
    db.project.findMany({ where: { ownerId: user.id }, select: { id: true } }),
  ]);
  memberships.forEach((m) => ids.add(m.projectId));
  taskProjects.forEach((t) => ids.add(t.projectId));
  owned.forEach((p) => ids.add(p.id));

  return [...ids];
}

export async function canSeeProject(user: SessionUser, projectId: string): Promise<boolean> {
  const visible = await getVisibleProjectIds(user);
  return visible === "all" || visible.includes(projectId);
}

export function projectWhere(visible: string[] | "all") {
  return visible === "all" ? {} : { id: { in: visible } };
}

export function taskProjectWhere(visible: string[] | "all") {
  return visible === "all" ? {} : { projectId: { in: visible } };
}

// Leads for a given project: the PM + leads scoped to the project/business + Owner.
export async function getProjectManagers(projectId: string): Promise<string[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { business: true },
  });
  if (!project) return [];
  const assignments = await db.roleAssignment.findMany({
    where: {
      role: "lead",
      OR: [
        { scopeType: "project", scopeId: projectId },
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
export async function canManageProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.isOwner) return true;
  const managers = await getProjectManagers(projectId);
  return managers.includes(user.id);
}
