// Status buckets for the global kanban (/board). Columns are derived — never
// self-reported — from pipeline position and the deadline:
//   backlog   — still in the first stage of its vertical's pipeline
//   pending   — mid-pipeline (started, not finished)
//   due       — open and overdue or due within 48h (wins over backlog/pending)
//   completed — reached the terminal stage
//   approved  — terminal stage reached AND the terminal stage is a client-
//               approval type ("Approved", "Verified", "Client UAT", …)

export type Bucket = "backlog" | "pending" | "due" | "completed" | "approved";

export const APPROVED_TERMINAL_REGEX = /approved|verified|client/i;

export const DUE_WINDOW_HOURS = 48;

export function computeBucket(input: {
  completedAt: Date | null;
  dueDate: Date;
  stageId: string;
  firstStageId: string | undefined;
  terminalStageName: string | undefined;
  now?: Date;
}): Bucket {
  const now = input.now ?? new Date();
  if (input.completedAt) {
    return input.terminalStageName && APPROVED_TERMINAL_REGEX.test(input.terminalStageName)
      ? "approved"
      : "completed";
  }
  if (input.dueDate.getTime() < now.getTime() + DUE_WINDOW_HOURS * 3600 * 1000) return "due";
  if (input.stageId === input.firstStageId) return "backlog";
  return "pending";
}

export const BUCKET_COLUMNS: { key: Bucket; title: string; accent: string; droppable: boolean }[] = [
  { key: "backlog", title: "Backlog", accent: "#0f172a", droppable: true },
  { key: "pending", title: "Pending", accent: "#3d64f1", droppable: true },
  { key: "due", title: "Due", accent: "#e11d48", droppable: false },
  { key: "completed", title: "Completed", accent: "#059669", droppable: true },
  { key: "approved", title: "Client approved", accent: "#7c3aed", droppable: true },
];
