// Shared display helpers (server + client safe).
// Currency and date formatting follow LOCALE / CURRENCY in lib/brand.ts.

import { LOCALE, CURRENCY, CURRENCY_SYMBOL, useIndianNumbering } from "./brand";

export function money(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency", currency: CURRENCY, maximumFractionDigits: 0,
  }).format(amount);
}

export function moneyCompact(amount: number): string {
  const c = CURRENCY_SYMBOL;
  if (useIndianNumbering) {
    if (amount >= 10000000) return `${c}${(amount / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
    if (amount >= 100000) return `${c}${(amount / 100000).toFixed(1).replace(/\.0$/, "")}L`;
    if (amount >= 1000) return `${c}${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return money(amount);
  }
  if (amount >= 1000000000) return `${c}${(amount / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
  if (amount >= 1000000) return `${c}${(amount / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1000) return `${c}${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return money(amount);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function relativeDue(due: Date | string): { label: string; tone: "overdue" | "today" | "soon" | "ok" } {
  const date = typeof due === "string" ? new Date(due) : due;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (diffMs < 0) {
    const overdueDays = Math.max(1, Math.ceil(-diffMs / (24 * 3600 * 1000)));
    return { label: `${overdueDays}d overdue`, tone: "overdue" };
  }
  if (isSameDay(date, now)) return { label: "due today", tone: "today" };
  if (days < 2) return { label: "due tomorrow", tone: "soon" };
  if (days < 7) return { label: `due in ${days + 1}d`, tone: "soon" };
  return { label: fmtDate(date), tone: "ok" };
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function durationShort(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10);
}
