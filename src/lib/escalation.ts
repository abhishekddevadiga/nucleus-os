import { db } from "./db";
import { logActivity } from "./activity";
import { notify, notifyMany } from "./notify";
import { getProjectManagers, getCeoUserIds } from "./permissions";

// Deadline & escalation engine. Runs every minute (instrumentation
// interval in-process, or POST /api/cron/escalations from an external cron) so
// every rung fires well inside the 5-minute SLA.
//
// Rules live in EscalationRule rows. Resolution: the most specific scope wins —
// project > client > division > company. Each rung is idempotent via
// task.escalationLevel (monotonically increasing per active deadline).

interface Rule {
  offsetHours: number;
  action: string;
  level: number;
}

async function resolveLadder(projectId: string, clientId: string, divisionId: string): Promise<Rule[]> {
  const rules = await db.escalationRule.findMany({ where: { enabled: true } });
  const byScope = (type: string, id: string) =>
    rules.filter((r) => r.scopeType === type && r.scopeId === id);
  const ladder =
    firstNonEmpty(
      byScope("project", projectId),
      byScope("client", clientId),
      byScope("division", divisionId),
      rules.filter((r) => r.scopeType === "company")
    ) ?? [];
  return ladder.sort((a, b) => a.level - b.level);
}

function firstNonEmpty<T>(...lists: T[][]): T[] | null {
  for (const l of lists) if (l.length) return l;
  return null;
}

export async function runEscalationSweep(): Promise<{ fired: number; checked: number }> {
  const now = new Date();
  let fired = 0;

  // Open tasks only: not archived, not in a terminal stage.
  const tasks = await db.task.findMany({
    where: { archivedAt: null, completedAt: null, escalationLevel: { lt: 4 } },
    include: {
      project: { include: { client: true } },
      assignee: true,
    },
  });

  for (const task of tasks) {
    const ladder = await resolveLadder(task.projectId, task.project.clientId, task.project.client.divisionId);
    for (const rule of ladder) {
      if (task.escalationLevel >= rule.level) continue;
      const triggerAt = new Date(task.dueDate.getTime() + rule.offsetHours * 3600 * 1000);
      if (now < triggerAt) break; // ladder is ordered; later rungs are further out

      await fireRule(task, rule, now);
      task.escalationLevel = rule.level; // keep local copy in sync for next rung
      fired++;
    }
  }

  // Invoices: auto-overdue on due-date cross.
  const overdueInvoices = await db.invoice.findMany({
    where: { archivedAt: null, status: { in: ["sent", "partial"] }, dueDate: { lt: now } },
  });
  for (const inv of overdueInvoices) {
    await db.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
    await logActivity({
      entityType: "invoice",
      entityId: inv.id,
      action: "escalation.invoice_overdue",
      fromValue: inv.status,
      toValue: "overdue",
      clientId: inv.clientId,
      projectId: inv.projectId,
    });
    fired++;
  }

  return { fired, checked: tasks.length };
}

async function fireRule(
  task: {
    id: string;
    title: string;
    isTicket: boolean;
    dueDate: Date;
    projectId: string;
    assigneeId: string;
    project: { clientId: string; name: string };
    assignee: { name: string };
  },
  rule: Rule,
  now: Date
) {
  const entityType = task.isTicket ? "ticket" : "task";
  const base = {
    entityType,
    entityId: task.id,
    projectId: task.projectId,
    clientId: task.project.clientId,
    taskId: task.id,
  };

  switch (rule.action) {
    case "remind_assignee": {
      await db.task.update({ where: { id: task.id }, data: { escalationLevel: rule.level } });
      await logActivity({ ...base, action: "escalation.reminded", toValue: task.dueDate.toISOString() });
      await notify({
        userId: task.assigneeId,
        type: "reminder",
        title: `Due in <24h: ${task.title}`,
        body: `Deadline ${task.dueDate.toLocaleString()} · ${task.project.name}`,
        link: `/tasks/${task.id}`,
        channels: ["in_app", "whatsapp", "email"],
      });
      break;
    }
    case "mark_overdue_notify_pm": {
      await db.task.update({
        where: { id: task.id },
        data: { escalationLevel: rule.level, overdueSince: task.dueDate },
      });
      await logActivity({ ...base, action: "escalation.overdue", fromValue: task.dueDate.toISOString(), toValue: now.toISOString() });
      const managers = await getProjectManagers(task.projectId);
      await notifyMany(managers, {
        type: "overdue",
        title: `OVERDUE: ${task.title}`,
        body: `${task.assignee.name} · was due ${task.dueDate.toLocaleString()} · ${task.project.name}`,
        link: `/tasks/${task.id}`,
      });
      break;
    }
    case "escalate_ceo": {
      await db.task.update({ where: { id: task.id }, data: { escalationLevel: rule.level } });
      await logActivity({ ...base, action: "escalation.ceo", toValue: "T+24h" });
      const ceos = await getCeoUserIds();
      await notifyMany(ceos, {
        type: "escalation",
        title: `Escalated (24h overdue): ${task.title}`,
        body: `${task.assignee.name} · ${task.project.name}`,
        link: `/tasks/${task.id}`,
        channels: ["in_app", "whatsapp", "email"],
      });
      break;
    }
    case "schedule_review_lock": {
      await db.task.update({
        where: { id: task.id },
        data: { escalationLevel: rule.level, deadlineLocked: true },
      });
      await logActivity({ ...base, action: "escalation.review_scheduled", toValue: "deadline edits locked" });
      const managers = await getProjectManagers(task.projectId);
      const ceos = await getCeoUserIds();
      await notifyMany([...managers, ...ceos, task.assigneeId], {
        type: "escalation",
        title: `Review scheduled (48h overdue): ${task.title}`,
        body: `Silent deadline edits are now locked. ${task.assignee.name} · ${task.project.name}`,
        link: `/tasks/${task.id}`,
      });
      break;
    }
    default: {
      // Unknown action (e.g. a future custom rule) — still advance the level so
      // the engine never spins on it, and record what happened.
      await db.task.update({ where: { id: task.id }, data: { escalationLevel: rule.level } });
      await logActivity({ ...base, action: `escalation.unknown_action`, toValue: rule.action });
    }
  }
}
