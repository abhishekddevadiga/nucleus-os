import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError, ForbiddenError } from "@/lib/tasks";
import { canManageProject } from "@/lib/permissions";

export const POST = withUser(async (req, user) => {
  const input = await body<{ projectId: string; title: string; dueDate: string; billable?: boolean; amount?: number }>(req);
  if (!input.title?.trim()) throw new ValidationError("Milestone title required.");
  if (!input.dueDate) throw new ValidationError("Milestones cannot be saved without a due date.");
  const project = await db.project.findFirst({ where: { id: input.projectId, archivedAt: null } });
  if (!project) throw new ValidationError("Project not found.");
  if (!(await canManageProject(user, project.id))) throw new ForbiddenError("Only the PM or CEO can add milestones.");

  const milestone = await db.milestone.create({
    data: {
      projectId: input.projectId,
      title: input.title.trim(),
      dueDate: new Date(input.dueDate),
      billable: !!input.billable,
      amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    },
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "milestone", entityId: milestone.id,
    action: "created", toValue: milestone.title,
    projectId: project.id, clientId: project.clientId,
  });
  return ok({ id: milestone.id });
});
