import { db } from "./db";

// Morning digest: deadlines crossed yesterday (with escalation
// state), due today, blocked/locked tasks, wins.
// Rendered on the Command Center and dispatchable via notification channels.

export async function buildDigest(now = new Date()) {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday.getTime() + 24 * 3600 * 1000);
  const startYesterday = new Date(startToday.getTime() - 24 * 3600 * 1000);

  const [crossedYesterday, dueToday, lockedTasks, wins] = await Promise.all([
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, dueDate: { gte: startYesterday, lt: startToday } },
      include: { assignee: true, campaign: { include: { business: true } }, stage: true },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, dueDate: { gte: startToday, lt: endToday } },
      include: { assignee: true, campaign: { include: { business: true } }, stage: true },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: null, deadlineLocked: true },
      include: { assignee: true, campaign: { include: { business: true } } },
    }),
    db.task.findMany({
      where: { archivedAt: null, completedAt: { gte: startYesterday } },
      include: { assignee: true, campaign: { include: { business: true } }, stage: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
  ]);

  // All overdue (not just yesterday) for the headline number.
  const allOverdue = await db.task.count({
    where: { archivedAt: null, completedAt: null, dueDate: { lt: now } },
  });

  return {
    generatedAt: now,
    crossedYesterday,
    dueToday,
    lockedTasks,
    wins,
    allOverdue,
  };
}

export type Digest = Awaited<ReturnType<typeof buildDigest>>;
