import { LOCALE, CURRENCY, CURRENCY_SYMBOL, useIndianNumbering } from "./brand";

// Command Center — data model + derivations.
// Everything downstream (KPIs, digest, people, health tree, decision queue,
// trends) is *derived* from these primitives — nothing is manually reported.
// The arrays below start empty; wire them to your API or Prisma queries.

export const NOW = new Date();
export type Division = "services" | "products" | "internal";

export const DIVISIONS: { id: Division; label: string }[] = [
  { id: "services", label: "Client Services" },
  { id: "products", label: "Products" },
  { id: "internal", label: "Internal" },
];

export type Business = { id: string; name: string; division: Division; kind: "client" | "brand" | "product" | "program" };
export type Person = { id: string; name: string; role: string; photo: number; loadH: number; capacityH: number };
export type Vertical = { name: string; progress: number };
export type Campaign = {
  id: string; name: string; businessId: string; division: Division;
  health: "on_track" | "at_risk" | "delayed";
  milestone: { name: string; date: string };
  verticals: Vertical[];
};
export type TaskStatus = "in_progress" | "blocked" | "done";
export type Task = {
  id: string; title: string; assigneeId: string; businessId: string; campaignId: string; division: Division;
  vertical: string; stage: string; status: TaskStatus; due: string; completedAt?: string;
  escalation: 0 | 1 | 2 | 3 | 4; blockedReason?: string;
};
export type Deal = { id: string; name: string; businessId: string; division: Division; value: number; stage: string; lastActivity: string; wonAwaitingConversion?: boolean };
export type Invoice = { id: string; businessId: string; division: Division; label: string; amount: number; status: "overdue" | "sent" | "paid"; due: string; paidAt?: string; needsApproval?: boolean };
export type Extension = { id: string; taskId: string; requestedBy: string; extraDays: number; reason: string };


// ---------------------------------------------------------------------------
// DATA — empty by design. Replace these with real queries when you wire the
// Command Center to the database; every derived view below adapts automatically.
// ---------------------------------------------------------------------------

export const BUSINESSES: Business[] = [];
export const PEOPLE: Person[] = [];
export const PROJECTS: Campaign[] = [];
export const TASKS: Task[] = [];
export const DEALS: Deal[] = [];
export const INVOICES: Invoice[] = [];
export const EXTENSIONS: Extension[] = [];

export const TRENDS = {
  onTimeThisWeek: 0, onTimeLastWeek: 0,
  slowestStage: { name: "—", avgDays: 0 },
  utilization: 0,
  billed: 0, collected: 0,
};

/* ---------------- helpers ---------------- */
export function money(n: number) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency", currency: CURRENCY, maximumFractionDigits: 0,
  }).format(n);
}

export function moneyShort(n: number) {
  if (useIndianNumbering) {
    if (n >= 10000000) return CURRENCY_SYMBOL + (n / 10000000).toFixed(2).replace(/\.00$/, "") + "Cr";
    if (n >= 100000) return CURRENCY_SYMBOL + (n / 100000).toFixed(2).replace(/\.00$/, "") + "L";
    return money(n);
  }
  if (n >= 1000000000) return CURRENCY_SYMBOL + (n / 1000000000).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1000000) return CURRENCY_SYMBOL + (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1000) return CURRENCY_SYMBOL + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return money(n);
}

const DAY = 86400000;
// Whole calendar-day difference: a task due yesterday is 1 day overdue.
const NOW_MIDNIGHT = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
export function daysOverdue(due: string) {
  const d = new Date(due + "T00:00:00");
  return Math.round((NOW_MIDNIGHT - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
}
export function isDueToday(due: string) {
  return daysOverdue(due) === 0;
}
export function isOverdue(t: Task) {
  return t.status !== "done" && daysOverdue(t.due) > 0;
}
export function rungLabel(level: number) {
  return level >= 4 ? "Forced review" : level >= 3 ? "Escalated to owner" : level >= 2 ? "PM escalated" : level >= 1 ? "PM notified" : "Flagged";
}
export function personById(id: string) { return PEOPLE.find((p) => p.id === id)!; }
export function businessById(id: string) { return BUSINESSES.find((b) => b.id === id)!; }
export function projectById(id: string) { return PROJECTS.find((p) => p.id === id)!; }
export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}
