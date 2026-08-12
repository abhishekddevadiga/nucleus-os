"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// In-app vertical builder: rename, reorder-by-editing, add/remove
// stages. The last stage is always terminal.

interface StageDraft {
  id?: string;
  name: string;
}

export default function VerticalEditor({
  vertical,
}: {
  vertical: { id: string; name: string; isSystem: boolean; stages: { id: string; name: string }[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(vertical.name);
  const [stages, setStages] = useState<StageDraft[]>(vertical.stages);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(i: number, value: string) {
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, name: value } : st)));
    setDirty(true);
  }
  function remove(i: number) {
    setStages((s) => s.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function add() {
    setStages((s) => [...s, { name: "" }]);
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setStages((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/verticals/${vertical.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stages: stages.filter((s) => s.name.trim()) }),
    });
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed.");
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <input
          className="input max-w-xs font-semibold"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
        {vertical.isSystem && <span className="chip bg-fuchsia-100 text-fuchsia-700">system</span>}
        {dirty && (
          <button onClick={save} className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {stages.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="flex items-center gap-1.5">
            <span className="w-5 text-right text-xs text-slate-400">{i + 1}.</span>
            <input className="input max-w-sm" value={s.name} onChange={(e) => update(i, e.target.value)} placeholder="Stage name" />
            {i === stages.length - 1 && <span className="chip bg-emerald-100 text-emerald-700">terminal ✓</span>}
            <button onClick={() => move(i, -1)} className="btn-ghost px-2 py-1" title="Move up">↑</button>
            <button onClick={() => move(i, 1)} className="btn-ghost px-2 py-1" title="Move down">↓</button>
            <button onClick={() => remove(i)} className="btn-ghost px-2 py-1 text-rose-600" title="Remove">✕</button>
          </div>
        ))}
        <button onClick={add} className="btn-ghost mt-1">+ Add stage</button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
