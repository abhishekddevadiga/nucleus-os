import { LOCALE } from "./brand";

// Approvals — a single inbox of everything waiting on the current user.
// An approval is NOT a stored object: it's derived from an existing item
// (a task in a review stage, an extension request, a triaged ticket) that
// happens to be waiting on you. Acting performs the real workflow action and
// writes to the activity log.

export const NOW = new Date();
export const ME = { name: "You", photo: 1 };

export type Requester = { name: string; photo: number };
export type Kind = "stage" | "extension" | "ticket";

export type Approval = {
  id: string; kind: Kind; title: string; client: string; vertical?: string;
  stage?: string; nextStage?: string; requester: Requester; arrivedAt: string;
  asset?: { label: string; type: "video" | "doc" | "link" | "pr" };
  oldDate?: string; newDate?: string; reason?: string; severity?: string;
};
export type Requested = {
  id: string; kind: Kind; title: string; client: string; vertical?: string;
  stage?: string; nextStage?: string; approver: Requester; sentAt: string; nudgedAt: string | null;
  oldDate?: string; newDate?: string; reason?: string;
};
export type Decision = {
  id: string; kind: Kind; title: string; client: string; decidedAt: string; decider: string;
  action: "approved" | "rejected"; from?: string; to?: string; reason?: string;
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

const HOUR = 3600000;
export function hoursWaiting(iso: string) { return Math.round((NOW.getTime() - new Date(iso).getTime()) / HOUR); }
export function waitLabel(iso: string) {
  const h = hoursWaiting(iso);
  const text = h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`;
  return { text: `waiting ${text}`, stale: h > 24 };
}
export function whenLabel(iso: string) {
  const h = hoursWaiting(iso);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}
export function canNudge(nudgedAt: string | null) { return !nudgedAt || hoursWaiting(nudgedAt) >= 24; }

const ago = (h: number) => new Date(NOW.getTime() - h * HOUR).toISOString();


// ---------------------------------------------------------------------------
// DATA — empty by design. Wire these to your API when you connect Approvals
// to the database.
// ---------------------------------------------------------------------------

const PENDING: Approval[] = [];
const REQUESTED: Requested[] = [];
const HISTORY: Decision[] = [];

export function seedPending() { return PENDING.map((a) => ({ ...a })); }
export function seedRequested() { return REQUESTED.map((r) => ({ ...r })); }
export function seedHistory() { return HISTORY.map((d) => ({ ...d })); }
export function pendingApprovalCount() { return PENDING.length; }
