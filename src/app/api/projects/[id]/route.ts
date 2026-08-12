import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { archiveProject } from "@/lib/projects";
import { ValidationError, ForbiddenError } from "@/lib/tasks";
import { canManageProject } from "@/lib/permissions";

export const PATCH = withUser(async (req, user, params) => {
  const input = await body<{
    archive?: boolean;
    status?: string;
    addVerticalId?: string;
    name?: string;
    value?: number;
    endDate?: string;
    notes?: string;
  }>(req);

  const project = await db.project.findUnique({ where: { id: params.id } });
  if (!project) throw new ValidationError("Project not found.");
  if (!(await canManageProject(user, params.id))) {
    throw new ForbiddenError("Only the PM or CEO can edit this project.");
  }

  if (input.archive) {
    await archiveProject(user, params.id);
    return ok();
  }

  if (input.addVerticalId) {
    const vertical = await db.vertical.findFirst({ where: { id: input.addVerticalId, archivedAt: null } });
    if (!vertical) throw new ValidationError("Vertical not found.");
    await db.projectVertical.upsert({
      where: { projectId_verticalId: { projectId: params.id, verticalId: vertical.id } },
      create: { projectId: params.id, verticalId: vertical.id },
      update: {},
    });
    await logActivity({
      actorId: user.id, actorName: user.name,
      entityType: "project", entityId: params.id,
      action: "vertical_attached", toValue: vertical.name,
      projectId: params.id, clientId: project.clientId,
    });
  }

  const fields: Record<string, unknown> = {};
  if (input.name?.trim()) fields.name = input.name.trim();
  if (input.value !== undefined) fields.value = Math.max(0, Math.round(Number(input.value) || 0));
  if (input.endDate) fields.endDate = new Date(input.endDate);
  if (input.notes !== undefined) fields.notes = input.notes.trim() || null;
  if (input.status && ["active", "completed"].includes(input.status)) fields.status = input.status;
  if (Object.keys(fields).length) {
    await db.project.update({ where: { id: params.id }, data: fields });
    await logActivity({
      actorId: user.id, actorName: user.name,
      entityType: "project", entityId: params.id,
      action: "updated", meta: { fields: Object.keys(fields) },
      projectId: params.id, clientId: project.clientId,
    });
  }
  return ok();
});
