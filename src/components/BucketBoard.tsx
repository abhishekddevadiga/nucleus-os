"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Bucket } from "@/lib/buckets";

// Global status-bucket kanban. Dragging a card onto a column moves the task
// to the matching pipeline stage of its own vertical (backlog → first stage,
// pending → next working stage, completed/approved → terminal stage). "Due"
// is deadline-driven, so it isn't a drop target — fix the deadline instead.

export interface BucketCard {
  id: string;
  title: string;
  bucket: Bucket;
  priority: string;
  estimateHours: number;
  dueLabel: string;
  overdue: boolean;
  isTicket: boolean;
  isVariation: boolean;
  clientName: string;
  verticalName: string;
  stageName: string;
  assignee: { name: string; avatarColor: string };
  targets: { backlog?: string; progress?: string; done?: string };
}

export interface BucketColumn {
  key: Bucket;
  title: string;
  accent: string;
  droppable: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: "#e11d48",
  high: "#f97316",
  medium: "#94a3b8",
  low: "#cbd5e1",
};

export default function BucketBoard({ columns, cards }: { columns: BucketColumn[]; cards: BucketCard[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Bucket | null>(null);
  const [pending, setPending] = useState<Record<string, Bucket>>({});

  function targetStage(card: BucketCard, bucket: Bucket): string | undefined {
    if (bucket === "backlog") return card.targets.backlog;
    if (bucket === "pending") return card.targets.progress;
    return card.targets.done; // completed & approved both end the pipeline
  }

  async function drop(cardId: string, bucket: Bucket) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.bucket === bucket) return;
    const stageId = targetStage(card, bucket);
    if (!stageId) return;
    setPending((p) => ({ ...p, [cardId]: bucket }));
    const res = await fetch(`/api/tasks/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (!res.ok) {
      setPending((p) => {
        const { [cardId]: _, ...rest } = p;
        return rest;
      });
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Could not move task.");
    }
    router.refresh();
  }

  const bucketOf = (c: BucketCard) => pending[c.id] ?? c.bucket;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const inCol = cards.filter((c) => bucketOf(c) === col.key);
        return (
          <div
            key={col.key}
            className={`w-72 shrink-0 rounded-2xl p-2.5 transition-colors ${
              over === col.key && col.droppable ? "bg-brand-50 ring-2 ring-brand-300" : "bg-slate-100/80"
            }`}
            onDragOver={(e) => {
              if (!col.droppable) return;
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragId && col.droppable) drop(dragId, col.key);
              setDragId(null);
            }}
          >
            <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-canvas-sunken px-3 py-2.5 shadow-sm">
              <span className="h-4 w-1 rounded-full" style={{ backgroundColor: col.accent }} />
              <p className="text-sm font-semibold text-slate-800">{col.title}</p>
              <span className="text-xs font-medium text-slate-400">{inCol.length}</span>
              {!col.droppable && (
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-300" title="Deadline-driven — change the due date to clear it">
                  auto
                </span>
              )}
            </div>

            <div className="flex min-h-24 flex-col gap-2.5">
              {inCol.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDragId(card.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`group cursor-grab rounded-xl border bg-canvas-raised p-3 shadow-sm transition-shadow hover:border-slate-300 ${
                    card.overdue && col.key === "due" ? "border-rose-200" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: card.assignee.avatarColor }}
                      title={card.assignee.name}
                    >
                      {card.assignee.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PRIORITY_DOT[card.priority] ?? PRIORITY_DOT.medium }}
                      title={`${card.priority} priority`}
                    />
                  </div>

                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {card.clientName} · {card.verticalName}
                  </p>
                  <Link href={`/tasks/${card.id}`} className="mt-0.5 block text-sm font-medium leading-snug text-slate-800 hover:text-brand-700">
                    {card.isTicket && (
                      <span className="mr-1.5 rounded bg-fuchsia-100 px-1 py-0.5 text-[9px] font-bold text-fuchsia-700 align-middle">TICKET</span>
                    )}
                    {card.isVariation && (
                      <span className="mr-1.5 rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-bold text-indigo-700 align-middle">VAR</span>
                    )}
                    {card.title}
                  </Link>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {card.stageName}
                    </span>
                    {card.estimateHours > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {card.estimateHours}h
                      </span>
                    )}
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        card.overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {card.dueLabel}
                    </span>
                  </div>
                </div>
              ))}
              {inCol.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                  {col.droppable ? "Drop cards here" : "Nothing due — good."}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
