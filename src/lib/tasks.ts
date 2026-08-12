import { db } from "./db";
import { logActivity } from "./activity";
import { notify, notifyMany } from "./notify";
import { getProjectManagers } from "./permissions";
import { PRIORITIES, CHANGE_REQUEST_SLUG } from "./constants";
import type { SessionUser } from "./auth";

// Task service — the enforcement point for the system's hard rules:
//   * every task has title, project, vertical, stage, exactly one assignee,
//     a non-null due date, priority, estimate
//   * deadline edits require a reason; original date is preserved forever;
//     assignees cannot edit their own deadlines
//   * every mutation writes to the activity log

export class ValidationError extends Error {
  status = 400;
}
export class ForbiddenError extends Error {
  status = 403;
}

export interface CreateTaskInput {
  title: string;
  projectId: string;
  verticalId: string;
  stageId?: string; // defaults to first stage of the vertical
  assigneeId: string;
  dueDate: string | Date;
  priority?: string;
  estimateHours?: number;
  description?: string;
  tags?: string;
  masterTaskId?: string;
  isTicket?: boolean;
  ticketType?: string;
  raisedById?: string;
  subtasks?: string[];
  watcherIds?: string[];
}

export async function createTask(actor: SessionUser, input: CreateTaskInput) {
  const title = input.title?.trim();
  if (!title) throw new ValidationError("Task title is required.");
  if (!input.projectId) throw new ValidationError("Task must belong to a project.");
  if (!input.verticalId) throw new ValidationError("Task must belong to a vertical.");
  if (!input.assigneeId) throw new ValidationError("Task must have exactly one assignee.");
  if (!input.dueDate) throw new ValidationError("Task cannot be saved without a due date.");
  const dueDate = new Date(input.dueDate);
  if (isNaN(dueDate.getTime())) throw new ValidationError("Invalid due date.");
  const priority = input.priority ?? "medium";
  if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
    throw new ValidationError(`Invalid priority "${priority}".`);
  }

  const [project, attached, assignee] = await Promise.all([
    db.project.findFirst({ where: { id: input.projectId, archivedAt: null } }),
    db.projectVertical.findFirst({
      where: { projectId: input.projectId, verticalId: input.verticalId },
      include: { vertical: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } } },
    }),
    db.user.findFirst({ where: { id: input.assigneeId, archivedAt: null } }),
  ]);
  if (!project) throw new ValidationError("Project not found or archived.");
  if (!attached) throw new ValidationError("That vertical is not attached to this project.");
  if (!assignee) throw new ValidationError("Assignee not found.");
  const stages = attached.vertical.stages;
  if (!stages.length) throw new ValidationError("Vertical has no pipeline stages.");
  const stage = input.stageId ? stages.find((s) => s.id === input.stageId) : stages[0];
  if (!stage) throw new ValidationError("Stage does not belong to this vertical.");

  if (input.masterTaskId) {
    const master = await db.task.findFirst({ where: { id: input.masterTaskId, projectId: input.projectId } });
    if (!master) throw new ValidationError("Master task for this variation was not found in the project.");
  }

  const task = await db.task.create({
    data: {
      title,
      projectId: input.projectId,
      verticalId: input.verticalId,
      stageId: stage.id,
      assigneeId: input.assigneeId,
      creatorId: actor.id,
      dueDate,
      originalDueDate: dueDate,
      priority,
      estimateHours: input.estimateHours ?? 0,
      description: input.description?.trim() || null,
      tags: input.tags?.trim() || null,
      masterTaskId: input.masterTaskId || null,
      isTicket: input.isTicket ?? false,
      ticketType: input.isTicket ? input.ticketType ?? "change" : null,
      raisedById: input.isTicket ? input.raisedById ?? actor.id : null,
      subtasks: input.subtasks?.length
        ? { create: input.subtasks.filter((s) => s.trim()).map((s) => ({ title: s.trim() })) }
        : undefined,
      watchers: input.watcherIds?.length
        ? { create: [...new Set(input.watcherIds)].map((userId) => ({ userId })) }
        : undefined,
    },
  });

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: task.isTicket ? "ticket" : "task",
    entityId: task.id,
    action: "created",
    toValue: stage.name,
    meta: { title, assigneeId: input.assigneeId, dueDate: dueDate.toISOString() },
    projectId: project.id,
    clientId: project.clientId,
    taskId: task.id,
  });

  if (input.assigneeId !== actor.id) {
    await notify({
      userId: input.assigneeId,
      type: "assignment",
      title: `New ${task.isTicket ? "ticket" : "task"}: ${title}`,
      body: `Due ${dueDate.toDateString()} · assigned by ${actor.name}`,
      link: `/tasks/${task.id}`,
    });
  }
  return task;
}

export async function moveTaskStage(actor: SessionUser, taskId: string, stageId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    include: { stage: true, project: true, vertical: { include: { stages: { where: { archivedAt: null } } } }, assetLinks: true },
  });
  if (!task) throw new ValidationError("Task not found.");
  const target = task.vertical.stages.find((s) => s.id === stageId);
  if (!target) throw new ValidationError("Stage does not belong to this task's vertical.");
  if (target.id === task.stageId) return task;

  const nowCompleted = target.isTerminal;
  const updated = await db.task.update({
    where: { id: task.id },
    data: { stageId: target.id, completedAt: nowCompleted ? new Date() : null },
  });

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: task.isTicket ? "ticket" : "task",
    entityId: task.id,
    action: "stage_moved",
    fromValue: task.stage.name,
    toValue: target.name,
    projectId: task.projectId,
    clientId: task.project.clientId,
    taskId: task.id,
  });

  // Deliverables archive: terminal stage auto-registers linked
  // output assets as deliverables.
  if (nowCompleted) {
    const outputIds = task.assetLinks.filter((l) => l.direction === "output").map((l) => l.assetId);
    if (outputIds.length) {
      await db.asset.updateMany({ where: { id: { in: outputIds } }, data: { isDeliverable: true } });
      await logActivity({
        entityType: "asset",
        entityId: outputIds[0],
        action: "deliverable_registered",
        meta: { assetIds: outputIds, fromTask: task.id },
        projectId: task.projectId,
        clientId: task.project.clientId,
        taskId: task.id,
      });
    }
  }
  return updated;
}

// Deadline change: PM/CEO only, reason mandatory, both dates logged,
// PM notified, original preserved. Assignees must use extension requests.
export async function changeDueDate(
  actor: SessionUser,
  taskId: string,
  newDate: string | Date,
  reason: string,
  opts: { viaExtensionApproval?: boolean } = {}
) {
  if (!reason?.trim()) throw new ValidationError("A reason is required to change a deadline.");
  const due = new Date(newDate);
  if (isNaN(due.getTime())) throw new ValidationError("Invalid date.");

  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    include: { project: true },
  });
  if (!task) throw new ValidationError("Task not found.");

  const managers = await getProjectManagers(task.projectId);
  const isManager = actor.isCeo || managers.includes(actor.id);
  if (!opts.viaExtensionApproval) {
    if (task.assigneeId === actor.id && !isManager) {
      throw new ForbiddenError("Assignees cannot edit their own deadlines. Submit an extension request instead.");
    }
    if (!isManager) throw new ForbiddenError("Only the PM or CEO can change deadlines.");
    if (task.deadlineLocked && !actor.isCeo) {
      throw new ForbiddenError("Deadline edits are locked on this task (escalation T+48h). Only CEO/Ops can change it.");
    }
  }

  // Recompute escalation state against the new deadline so the ladder can
  // re-fire correctly (each rung logs when it fires; history stays in the log).
  const now = new Date();
  const nowOverdue = due < now;
  const updated = await db.task.update({
    where: { id: task.id },
    data: {
      dueDate: due,
      escalationLevel: nowOverdue ? task.escalationLevel : 0,
      overdueSince: nowOverdue ? task.overdueSince : null,
    },
  });

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: task.isTicket ? "ticket" : "task",
    entityId: task.id,
    action: "deadline_changed",
    fromValue: task.dueDate.toISOString(),
    toValue: due.toISOString(),
    meta: { reason, originalDueDate: task.originalDueDate.toISOString(), viaExtensionApproval: !!opts.viaExtensionApproval },
    projectId: task.projectId,
    clientId: task.project.clientId,
    taskId: task.id,
  });

  await notifyMany(managers.filter((id) => id !== actor.id), {
    type: "deadline",
    title: `Deadline changed: ${task.title}`,
    body: `${task.dueDate.toDateString()} → ${due.toDateString()} · ${reason} (${actor.name})`,
    link: `/tasks/${task.id}`,
  });
  return updated;
}

export async function requestExtension(actor: SessionUser, taskId: string, requestedDate: string | Date, reason: string) {
  if (!reason?.trim()) throw new ValidationError("A reason is required.");
  const date = new Date(requestedDate);
  if (isNaN(date.getTime())) throw new ValidationError("Invalid date.");
  const task = await db.task.findFirst({ where: { id: taskId, archivedAt: null }, include: { project: true } });
  if (!task) throw new ValidationError("Task not found.");

  const request = await db.extensionRequest.create({
    data: { taskId, requestedById: actor.id, requestedDate: date, reason: reason.trim() },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "extension_request",
    entityId: request.id,
    action: "created",
    toValue: date.toISOString(),
    meta: { reason },
    projectId: task.projectId,
    clientId: task.project.clientId,
    taskId,
  });
  const managers = await getProjectManagers(task.projectId);
  await notifyMany(managers, {
    type: "extension",
    title: `Extension requested: ${task.title}`,
    body: `${actor.name} → ${date.toDateString()} · ${reason}`,
    link: `/tasks/${taskId}`,
  });
  return request;
}

export async function decideExtension(actor: SessionUser, requestId: string, approve: boolean, note?: string) {
  const request = await db.extensionRequest.findUnique({
    where: { id: requestId },
    include: { task: { include: { project: true } } },
  });
  if (!request) throw new ValidationError("Extension request not found.");
  if (request.status !== "pending") throw new ValidationError("Request already decided.");
  const managers = await getProjectManagers(request.task.projectId);
  if (!actor.isCeo && !managers.includes(actor.id)) {
    throw new ForbiddenError("Only the PM or CEO can decide extension requests.");
  }

  const updated = await db.extensionRequest.update({
    where: { id: requestId },
    data: {
      status: approve ? "approved" : "rejected",
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: note?.trim() || null,
    },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "extension_request",
    entityId: requestId,
    action: approve ? "approved" : "rejected",
    toValue: request.requestedDate.toISOString(),
    meta: { note },
    projectId: request.task.projectId,
    clientId: request.task.project.clientId,
    taskId: request.taskId,
  });

  if (approve) {
    await changeDueDate(
      actor,
      request.taskId,
      request.requestedDate,
      `Extension approved: ${request.reason}`,
      { viaExtensionApproval: true }
    );
  }
  await notify({
    userId: request.requestedById,
    type: "extension",
    title: `Extension ${approve ? "approved" : "rejected"}: ${request.task.title}`,
    body: note || undefined,
    link: `/tasks/${request.taskId}`,
  });
  return updated;
}

export async function reassignTask(actor: SessionUser, taskId: string, assigneeId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    include: { assignee: true, project: true },
  });
  if (!task) throw new ValidationError("Task not found.");
  const assignee = await db.user.findFirst({ where: { id: assigneeId, archivedAt: null } });
  if (!assignee) throw new ValidationError("Assignee not found.");
  if (assignee.id === task.assigneeId) return task;

  const updated = await db.task.update({ where: { id: taskId }, data: { assigneeId } });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: task.isTicket ? "ticket" : "task",
    entityId: taskId,
    action: "reassigned",
    fromValue: task.assignee.name,
    toValue: assignee.name,
    projectId: task.projectId,
    clientId: task.project.clientId,
    taskId,
  });
  await notify({
    userId: assigneeId,
    type: "assignment",
    title: `Task assigned to you: ${task.title}`,
    body: `Due ${task.dueDate.toDateString()} · by ${actor.name}`,
    link: `/tasks/${taskId}`,
  });
  return updated;
}

export async function getChangeRequestVertical() {
  const vertical = await db.vertical.findUnique({ where: { slug: CHANGE_REQUEST_SLUG } });
  if (!vertical) throw new ValidationError("Change Requests vertical is missing.");
  return vertical;
}

// Tickets are tasks in the Change Request vertical. Ensures the
// vertical is attached to the project, then creates the ticket-task.
export async function raiseTicket(
  actor: SessionUser,
  input: Omit<CreateTaskInput, "verticalId" | "isTicket"> & { ticketType: string }
) {
  const vertical = await getChangeRequestVertical();
  await db.projectVertical.upsert({
    where: { projectId_verticalId: { projectId: input.projectId, verticalId: vertical.id } },
    create: { projectId: input.projectId, verticalId: vertical.id },
    update: {},
  });
  return createTask(actor, { ...input, verticalId: vertical.id, isTicket: true });
}
