import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";
import { ROLES } from "@/lib/constants";

export const PATCH = withUser(async (req, user, params) => {
  requireCeo(user);
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw new ValidationError("User not found.");
  const input = await body<{
    capacityHours?: number;
    title?: string;
    archive?: boolean;
    addRole?: { role: string; scopeType: string; scopeId: string };
    removeRoleId?: string;
  }>(req);

  const fields: Record<string, unknown> = {};
  if (input.capacityHours !== undefined) fields.capacityHours = Math.max(0, Number(input.capacityHours) || 0);
  if (input.title !== undefined) fields.title = input.title.trim() || null;
  if (input.archive) {
    const openTasks = await db.task.count({ where: { assigneeId: params.id, archivedAt: null, completedAt: null } });
    if (openTasks > 0) throw new ValidationError(`Reassign ${openTasks} open task(s) before archiving this person.`);
    fields.archivedAt = new Date();
  }
  if (Object.keys(fields).length) {
    await db.user.update({ where: { id: params.id }, data: fields });
  }
  if (input.addRole) {
    if (!ROLES.includes(input.addRole.role as never)) throw new ValidationError("Invalid role.");
    await db.roleAssignment.upsert({
      where: {
        userId_role_scopeType_scopeId: {
          userId: params.id,
          role: input.addRole.role,
          scopeType: input.addRole.scopeType,
          scopeId: input.addRole.scopeId,
        },
      },
      create: { userId: params.id, ...input.addRole },
      update: {},
    });
  }
  if (input.removeRoleId) {
    await db.roleAssignment.deleteMany({ where: { id: input.removeRoleId, userId: params.id } });
  }
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "user", entityId: params.id,
    action: "updated",
    meta: { fields: Object.keys(fields), addRole: input.addRole?.role, removedRole: !!input.removeRoleId },
  });
  return ok();
});
