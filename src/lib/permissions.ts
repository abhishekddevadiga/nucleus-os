import { db } from "./db";
import type { SessionUser } from "./auth";

// Role-scope resolution. Roles are assigned per scope; visibility:
//  - CEO / Finance: everything
//  - Sales: all deals + all clients (read), plus anything scoped to them
//  - Lead: divisions/clients/projects they lead — full view inside scope
//  - Member: projects where they hold tasks, watch tasks, or are members

export async function getVisibleProjectIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.isCeo || user.isFinance) return "all";

  const ids = new Set<string>();

  const leadDivisionIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "division").map((r) => r.scopeId);
  const leadClientIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "client").map((r) => r.scopeId);
  const leadProjectIds = user.roles.filter((r) => r.role === "lead" && r.scopeType === "project").map((r) => r.scopeId);
  const companyLead = user.roles.some((r) => r.role === "lead" && r.scopeType === "company");
  if (companyLead) return "all";

  if (leadDivisionIds.length || leadClientIds.length) {
    const projects = await db.project.findMany({
      where: {
        OR: [
          ...(leadClientIds.length ? [{ clientId: { in: leadClientIds } }] : []),
          ...(leadDivisionIds.length ? [{ client: { divisionId: { in: leadDivisionIds } } }] : []),
        ],
      },
      select: { id: true },
    });
    projects.forEach((p) => ids.add(p.id));
  }
  leadProjectIds.forEach((id) => ids.add(id));

  // membership + own/watched tasks + PM
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

// Leads for a given project: the PM + leads scoped to the project/client/division + CEO.
export async function getProjectManagers(projectId: string): Promise<string[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project) return [];
  const assignments = await db.roleAssignment.findMany({
    where: {
      role: "lead",
      OR: [
        { scopeType: "project", scopeId: projectId },
        { scopeType: "client", scopeId: project.clientId },
        { scopeType: "division", scopeId: project.client.divisionId },
      ],
    },
    select: { userId: true },
  });
  return [...new Set([project.ownerId, ...assignments.map((a) => a.userId)])];
}

export async function getCeoUserIds(): Promise<string[]> {
  const assignments = await db.roleAssignment.findMany({
    where: { role: "ceo" },
    select: { userId: true },
  });
  return [...new Set(assignments.map((a) => a.userId))];
}

// PM check used by approval flows: PM of project, lead in scope, or CEO.
export async function canManageProject(user: SessionUser, projectId: string): Promise<boolean> {
  if (user.isCeo) return true;
  const managers = await getProjectManagers(projectId);
  return managers.includes(user.id);
}
