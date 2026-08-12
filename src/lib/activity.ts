import { db } from "./db";

// The single write path for the activity log. Append-only by construction:
// nothing in the codebase updates or deletes ActivityLog rows, and on a
// Postgres deployment the DB user should additionally have UPDATE/DELETE
// revoked on the table.

export interface LogEntry {
  actorId?: string | null; // null/undefined => SYSTEM
  actorName?: string;
  entityType: string;
  entityId: string;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  meta?: Record<string, unknown>;
  projectId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
}

export async function logActivity(entry: LogEntry) {
  return db.activityLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? (entry.actorId ? "Unknown" : "SYSTEM"),
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      fromValue: entry.fromValue ?? null,
      toValue: entry.toValue ?? null,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
      projectId: entry.projectId ?? null,
      clientId: entry.clientId ?? null,
      taskId: entry.taskId ?? null,
    },
  });
}
