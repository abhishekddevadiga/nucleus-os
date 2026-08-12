import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";

const ACTIONS = ["remind_assignee", "mark_overdue_notify_pm", "escalate_ceo", "schedule_review_lock"];

// Replaces the ladder for a scope atomically (the editor submits the whole
// ladder). Rules for other scopes are untouched.
export const PUT = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{
    scopeType: string;
    scopeId: string;
    rules: { offsetHours: number; action: string; level: number; enabled: boolean }[];
  }>(req);
  if (!["company", "division", "client", "project"].includes(input.scopeType)) {
    throw new ValidationError("Invalid scope.");
  }
  if (!input.rules?.length) throw new ValidationError("At least one rule is required.");
  for (const rule of input.rules) {
    if (!ACTIONS.includes(rule.action)) throw new ValidationError(`Unknown action "${rule.action}".`);
    if (!Number.isFinite(rule.offsetHours)) throw new ValidationError("offsetHours must be a number.");
  }

  await db.escalationRule.deleteMany({ where: { scopeType: input.scopeType, scopeId: input.scopeId } });
  await db.escalationRule.createMany({
    data: input.rules.map((r, i) => ({
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      offsetHours: Math.round(r.offsetHours),
      action: r.action,
      level: r.level ?? i + 1,
      enabled: r.enabled ?? true,
    })),
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "escalation_rule", entityId: input.scopeId,
    action: "ladder_updated", meta: { scopeType: input.scopeType, rules: input.rules },
  });
  return ok();
});
