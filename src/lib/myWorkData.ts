import { LOCALE } from "./brand";

// My Work — the personal daily view for one team member.
// Task data starts empty; wire `seedTasks()` to your API when you connect it.

export const NOW = new Date();
export const ME = { name: "You", fullName: "Your Name", role: "Team member", photo: 1 };
export const CAPACITY_H = 40;

export type Priority = "urgent" | "high" | "medium" | "low";
export type Status = "todo" | "in_progress" | "done";
export type Task = {
  id: string; title: string; client: string; project: string; vertical: string; stage: string;
  due: string; priority: Priority; est: number; status: Status; isTicket?: boolean; escalation: 0 | 1 | 2 | 3 | 4;
};

// Per-client accent colours. Add entries as you add clients; anything not
// listed falls back to a stable colour derived from the name.
export const CLIENT_COLOR: Record<string, string> = {};

const FALLBACK_COLORS = ["#7b68ee", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];
export function clientColor(name: string): string {
  if (CLIENT_COLOR[name]) return CLIENT_COLOR[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

// Each vertical's ordered pipeline — powers "Move to next stage".
export const PIPELINE: Record<string, string[]> = {
  Scripting: ["Brief", "Writing", "Internal review", "Client review", "Approved"],
  Edits: ["Footage in", "Rough cut", "Internal review", "Revisions", "Delivered"],
  Tech: ["Scoped", "In development", "Code review", "QA", "Shipped"],
  Content: ["Brief", "Draft", "Edit", "Approved", "Published"],
  Variations: ["Queue", "In production", "QC", "Delivered"],
  Strategy: ["Research", "Draft", "Review", "Approved"],
};

export function stageIndex(vertical: string, stage: string) { return (PIPELINE[vertical] ?? []).indexOf(stage); }
export function nextStage(vertical: string, stage: string): string | null {
  const p = PIPELINE[vertical] ?? []; const i = p.indexOf(stage);
  return i >= 0 && i < p.length - 1 ? p[i + 1] : null;
}

// Stage colour by role in the pipeline: start → review → active → terminal.
export function stageTone(vertical: string, stage: string): "slate" | "sky" | "amber" | "emerald" {
  const p = PIPELINE[vertical] ?? []; const i = p.indexOf(stage);
  if (i === p.length - 1) return "emerald";
  if (/review|revision|qa|qc/i.test(stage)) return "amber";
  if (i <= 0) return "slate";
  return "sky";
}
export const TONE_HEX = { slate: "#94a3b8", sky: "#0ea5e9", amber: "#f59e0b", emerald: "#10b981", rose: "#f43f5e" } as const;

const DAY = 86400000;
const NOW_MID = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
function mid(due: string) { const d = new Date(due + "T00:00:00"); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
export function daysOverdue(due: string) { return Math.round((NOW_MID - mid(due)) / DAY); }
export function isOverdue(t: Task) { return t.status !== "done" && daysOverdue(t.due) > 0; }
export function isToday(due: string) { return mid(due) === NOW_MID; }
export function withinThisWeek(due: string) { const d = daysOverdue(due); return d < 0 && d >= -7; } // after today, within 7 days
export function dayLabel(due: string) {
  return new Date(due + "T00:00:00").toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" });
}
export function deadlineLabel(t: Task) {
  const d = daysOverdue(t.due);
  if (d > 0) return { text: `${d}d overdue`, tone: "rose" as const };
  if (d === 0) return { text: "Today", tone: "amber" as const };
  return { text: dayLabel(t.due), tone: "slate" as const };
}
export function rungTag(level: number) {
  if (level >= 3) return "Escalated to CEO";
  if (level >= 1) return "PM notified";
  return null;
}
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };


// ---------------------------------------------------------------------------
// DATA — empty by design. Wire this to your API when you connect My Work
// to the database.
// ---------------------------------------------------------------------------

const TASKS: Task[] = [];

export function seedTasks(): Task[] { return TASKS.map((t) => ({ ...t })); }
export function allProjects(tasks: Task[]) { return Array.from(new Set(tasks.map((t) => t.project))).sort(); }
