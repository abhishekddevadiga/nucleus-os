import { withUser, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { completeMilestone } from "@/lib/invoices";
import { ValidationError, ForbiddenError } from "@/lib/tasks";
import { canManageProject } from "@/lib/permissions";

export const POST = withUser(async (_req, user, params) => {
  const milestone = await db.milestone.findUnique({ where: { id: params.id } });
  if (!milestone) throw new ValidationError("Milestone not found.");
  if (!(await canManageProject(user, milestone.projectId))) {
    throw new ForbiddenError("Only the PM or CEO can complete milestones.");
  }
  const result = await completeMilestone(user, params.id);
  return ok({ invoiceId: result.invoice?.id ?? null });
});
