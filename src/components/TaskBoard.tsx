"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Kanban board for one vertical of one project. Stage-move is one
// drag (HTML5 DnD) or one click via the stage buttons on touch devices.

export interface BoardTask {
  id: string;
  title: string;
  stageId: string;
  priority: string;
  dueDate: string; // ISO
  isTicket: boolean;
  isOverdue: boolean;
  isVariation: boolean;
  completedAt: string | null;
  assignee: { name: string; avatarColor: string };
}

export interface BoardStage {
  id: string;
  name: string;
  isTerminal: boolean;
}

export default function TaskBoard({ stages, tasks }: { stages: BoardStage[]; tasks: BoardTask[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({}); // optimistic taskId -> stageId

  async function moveTo(taskId: string, stageId: string) {
    setPending((p) => ({ ...p, [taskId]: stageId }));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (!res.ok) {
      setPending((p) => {
        const { [taskId]: _, ...rest } = p;
        return rest;
      });
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not move task.");
    }
    router.refresh();
  }

  const stageOf = (t: BoardTask) => pending[t.id] ?? t.stageId;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {stages.map((stage) => {
        const inStage = tasks.filter((t) => stageOf(t) === stage.id);
        return (
          <div
            key={stage.id}
            className={`w-64 shrink-0 rounded-xl border p-2 transition-colors ${
              overStage === stage.id ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-slate-50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              if (dragId) moveTo(dragId, stage.id);
              setDragId(null);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {stage.name}
                {stage.isTerminal && " ✓"}
              </p>
              <span className="rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-500">{inStage.length}</span>
            </div>
            <div className="flex min-h-16 flex-col gap-2">
              {inStage.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragId(task.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`cursor-grab rounded-lg border bg-canvas-raised p-2.5 shadow-sm transition-shadow hover:border-slate-300 ${
                    task.isOverdue && !task.completedAt ? "border-rose-300" : "border-slate-200"
                  }`}
                >
                  <Link href={`/tasks/${task.id}`} className="block">
                    <p className="text-sm font-medium leading-snug text-slate-800">
                      {task.isTicket && (
                        <span className="mr-1 rounded bg-fuchsia-100 px-1 text-[10px] font-bold text-fuchsia-700">TICKET</span>
                      )}
                      {task.isVariation && (
                        <span className="mr-1 rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-700">VAR</span>
                      )}
                      {task.title}
                    </p>
                  </Link>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: task.assignee.avatarColor }}
                      title={task.assignee.name}
                    >
                      {task.assignee.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        task.isOverdue && !task.completedAt ? "text-rose-600" : "text-slate-400"
                      }`}
                    >
                      {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      {task.isOverdue && !task.completedAt && " ⚠"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
