import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export async function getDashboardData(user: SessionUser) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // My tasks (assigned to me)
  const myTasks = await db.task.findMany({
    where: {
      assigneeId: user.id,
      archivedAt: null,
      completedAt: null,
    },
    include: {
      campaign: { select: { id: true, name: true, businessId: true } },
      workstream: { select: { name: true } },
      stage: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  // Overdue tasks
  const overdueTasks = myTasks.filter((t) => t.dueDate < today);

  // Due today
  const dueTodayTasks = myTasks.filter(
    (t) => t.dueDate >= today && t.dueDate < tomorrow
  );

  // Due this week
  const dueThisWeekTasks = myTasks.filter(
    (t) => t.dueDate >= tomorrow && t.dueDate < weekFromNow
  );

  // Upcoming milestones
  const upcomingMilestones = await db.milestone.findMany({
    where: {
      archivedAt: null,
      dueDate: { gte: today, lt: weekFromNow },
    },
    include: {
      campaign: { select: { name: true, businessId: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  // Active campaigns
  const activeCampaigns = await db.campaign.findMany({
    where: {
      archivedAt: null,
      status: "active",
    },
    select: {
      id: true,
      name: true,
      status: true,
      businessId: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // Businesses
  const businesses = await db.business.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, slug: true, logoUrl: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  // Recent activity log
  const recentActivity = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  // Team members
  const teamMembers = await db.user.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      avatarColor: true,
      department: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    myTasks,
    overdueTasks,
    dueTodayTasks,
    dueThisWeekTasks,
    upcomingMilestones,
    activeCampaigns,
    businesses,
    recentActivity,
    teamMembers,
  };
}
