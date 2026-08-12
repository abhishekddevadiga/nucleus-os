import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

// Edit a vertical's stage list. Existing stages are renamed/reordered in
// place (by id); new names are appended; removed stages are archived only if
// no open task sits in them.
export const PATCH = withUser(async (req, user, params) => {
  requireCeo(user);
  const vertical = await db.vertical.findFirst({
    where: { id: params.id, archivedAt: null },
    include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
  });
  if (!vertical) throw new ValidationError("Vertical not found.");

  const input = await body<{ name?: string; stages?: { id?: string; name: string }[]; archive?: boolean }>(req);

  if (input.archive) {
    if (vertical.isSystem) throw new ValidationError("The Change Requests vertical cannot be archived.");
    const openTasks = await db.task.count({ where: { verticalId: vertical.id, archivedAt: null, completedAt: null } });
    if (openTasks > 0) throw new ValidationError(`Cannot archive: ${openTasks} open task(s) in this vertical.`);
    await db.vertical.update({ where: { id: vertical.id }, data: { archivedAt: new Date() } });
    await logActivity({ actorId: user.id, actorName: user.name, entityType: "vertical", entityId: vertical.id, action: "archived" });
    return ok();
  }

  if (input.name?.trim() && input.name.trim() !== vertical.name) {
    await db.vertical.update({ where: { id: vertical.id }, data: { name: input.name.trim() } });
  }

  if (input.stages) {
    const incoming = input.stages.map((s) => ({ id: s.id, name: s.name.trim() })).filter((s) => s.name);
    if (incoming.length < 2) throw new ValidationError("A vertical needs at least 2 stages.");
    const keptIds = new Set(incoming.filter((s) => s.id).map((s) => s.id!));

    for (const stage of vertical.stages) {
      if (!keptIds.has(stage.id)) {
        const inUse = await db.task.count({ where: { stageId: stage.id, archivedAt: null, completedAt: null } });
        if (inUse > 0) throw new ValidationError(`Cannot remove stage "${stage.name}": ${inUse} open task(s) in it.`);
        await db.pipelineStage.update({ where: { id: stage.id }, data: { archivedAt: new Date() } });
      }
    }
    for (const [idx, s] of incoming.entries()) {
      const isTerminal = idx === incoming.length - 1;
      if (s.id) {
        await db.pipelineStage.update({ where: { id: s.id }, data: { name: s.name, sortOrder: idx, isTerminal } });
      } else {
        await db.pipelineStage.create({ data: { verticalId: vertical.id, name: s.name, sortOrder: idx, isTerminal } });
      }
    }
  }

  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "vertical", entityId: vertical.id,
    action: "updated", meta: { name: input.name, stageCount: input.stages?.length },
  });
  return ok();
});
