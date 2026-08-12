import { db } from "./db";
import { WORKLOAD_AMBER, WORKLOAD_RED } from "./constants";

// Workload & capacity: per person per week, sum of estimates on
// open tasks + tickets due that week vs weekly capacity. Cross-business by
// design — one view over every brand/product a person works on.

export interface PersonLoad {
  userId: string;
  name: string;
  title: string | null;
  avatarColor: string;
  capacityHours: number;
  loadHours: number;
  openTasks: number;
  overdueTasks: number;
  ratio: number;
  band: "green" | "amber" | "red";
}

export function weekBounds(anchor = new Date()): { start: Date; end: Date } {
  const start = new Date(anchor);
  const day = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
  return { start, end };
}

export function bandFor(ratio: number): "green" | "amber" | "red" {
  if (ratio > WORKLOAD_RED) return "red";
  if (ratio >= WORKLOAD_AMBER) return "amber";
  return "green";
}

export async function getWorkload(anchor = new Date()): Promise<PersonLoad[]> {
  const { start, end } = weekBounds(anchor);
  const users = await db.user.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      assignedTasks: {
        where: { archivedAt: null, completedAt: null },
        select: { estimateHours: true, dueDate: true },
      },
    },
  });
  const now = new Date();
  return users.map((u) => {
    // Overdue work stays on your plate: count open tasks due before week end.
    const relevant = u.assignedTasks.filter((t) => t.dueDate < end);
    const thisWeek = relevant.filter((t) => t.dueDate >= start || t.dueDate < now);
    const loadHours = thisWeek.reduce((s, t) => s + t.estimateHours, 0);
    const overdue = u.assignedTasks.filter((t) => t.dueDate < now).length;
    const ratio = u.capacityHours > 0 ? loadHours / u.capacityHours : 0;
    return {
      userId: u.id,
      name: u.name,
      title: u.title,
      avatarColor: u.avatarColor,
      capacityHours: u.capacityHours,
      loadHours: Math.round(loadHours * 10) / 10,
      openTasks: u.assignedTasks.length,
      overdueTasks: overdue,
      ratio,
      band: bandFor(ratio),
    };
  });
}
