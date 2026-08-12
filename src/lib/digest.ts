import { db } from "./db";
import { STALE_DEAL_DAYS } from "./constants";

// Morning digest: deadlines crossed yesterday (with escalation
// state), due today, blocked/locked tasks, stale deals, overdue invoices, wins.
// Rendered on the Command Center and dispatchable via notification channels.

export async function buildDigest(now = new Date()) {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + 24 * 3600 * 1000);
  const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);
  const staleCutoff = new Date(now.getTime() - STALE_DEAL_DAYS * 24 * 3600 * 1000);

  const [crossedYesterday, dueToday, lockedTasks, staleDeals, overdueInvoices, wins] = await Promise.all([
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, dueDate: { gte: startYesterday, lt: startToday } },
      include: { assignee: true, project: { include: { client: true } }, stage: true },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, dueDate: { gte: startToday, lt: endToday } },
      include: { assignee: true, project: { include: { client: true } }, stage: true },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, deadlineLocked: true },
      include: { assignee: true, project: { include: { client: true } } },
    }),
    db.deal.findMany({
      where: {
        archivedAt: null,
        stage: { notIn: ["won", "lost", "completed", "paid"] },
        lastActivityAt: { lt: staleCutoff },
      },
      include: { owner: true, client: true },
    }),
    db.invoice.findMany({
      where: { archivedAt: null, status: "overdue" },
      include: { client: true, payments: true },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: { gte: startYesterday } },
      include: { assignee: true, project: { include: { client: true } }, stage: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  // All overdue (not just yesterday) for the headline number.
  const allOverdue = await db.task.count({
    where: { archivedAt: null, completedAt: null, dueDate: { lt: now } },
  });

  const overdueReceivable = overdueInvoices.reduce(
    (s, inv) => s + inv.total - inv.payments.reduce((p, x) => p + x.amount, 0),
    0
  );

  return {
    generatedAt: now,
    crossedYesterday,
    dueToday,
    lockedTasks,
    staleDeals,
    overdueInvoices,
    overdueReceivable,
    wins,
    allOverdue,
  };
}

export type Digest = Awaited<ReturnType<typeof buildDigest>>;
