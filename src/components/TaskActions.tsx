"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Interactive controls on the task detail page: stage move, deadline change
// (PM, with reason), extension request (assignee), reassign, quick edits.

export function StageMover({
  taskId,
  stages,
  currentStageId,
}: {
  taskId: string;
  stages: { id: string; name: string; isTerminal: boolean }[];
  currentStageId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const idx = stages.findIndex((s) => s.id === currentStageId);

  async function move(stageId: string) {
    setBusy(true);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Failed.");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <button
          key={s.id}
          onClick={() => move(s.id)}
          disabled={busy || s.id === currentStageId}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            s.id === currentStageId
              ? "bg-brand-500 text-white"
              : i < idx
                ? "bg-slate-100 text-slate-400 line-through"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

export function DeadlineChanger({ taskId, current, locked }: { taskId: string; current: string; locked: boolean }) {
  const router = useRouter();
  const [date, setDate] = useState(current.slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/deadline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: date + "T18:00:00", reason }),
    });
    setBusy(false);
    if (res.ok) {
      setReason("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {locked && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          🔒 Deadline edits locked by escalation (T+48h). Only CEO/Ops can change it.
        </p>
      )}
      <div className="flex gap-2">
        <input type="date" className="input w-40" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input
          className="input flex-1"
          placeholder="Reason (required, logged forever)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <button className="btn-ghost" disabled={busy}>Change</button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

export function ExtensionRequester({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/extension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedDate: date + "T18:00:00", reason }),
    });
    setBusy(false);
    if (res.ok) {
      setDate("");
      setReason("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input type="date" className="input w-40" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input
          className="input flex-1"
          placeholder="Why do you need more time?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <button className="btn-ghost" disabled={busy}>Request extension</button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

export function ExtensionDecider({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = await fetch(`/api/extensions/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Failed.");
    }
    router.refresh();
  }

  return (
    <span className="flex gap-1.5">
      <button onClick={() => decide(true)} disabled={busy} className="chip bg-emerald-600 text-white hover:opacity-80">
        Approve
      </button>
      <button onClick={() => decide(false)} disabled={busy} className="chip bg-rose-600 text-white hover:opacity-80">
        Reject
      </button>
    </span>
  );
}

export function Reassigner({
  taskId,
  currentAssigneeId,
  people,
}: {
  taskId: string;
  currentAssigneeId: string;
  people: { id: string; name: string; loadLabel: string }[];
}) {
  const router = useRouter();

  async function change(assigneeId: string) {
    if (assigneeId === currentAssigneeId) return;
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Failed.");
    }
    router.refresh();
  }

  // Workload shown at assignment time
  return (
    <select className="input" value={currentAssigneeId} onChange={(e) => change(e.target.value)}>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} — {p.loadLabel}
        </option>
      ))}
    </select>
  );
}

export function SubtaskToggle({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-brand-600"
      checked={done}
      onChange={async (e) => {
        await fetch(`/api/subtasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: e.target.checked }),
        });
        router.refresh();
      }}
    />
  );
}

export function CommentBox({ entityType, entityId }: { entityType: string; entityId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, body: text }),
    });
    setBusy(false);
    setText("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="input flex-1"
        placeholder="Write a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn-primary" disabled={busy || !text.trim()}>Post</button>
    </form>
  );
}
