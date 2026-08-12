"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Escalation ladder editor. Timings editable; every rung fires
// within 5 minutes of its trigger time.

const ACTIONS = [
  { value: "remind_assignee", label: "Remind assignee (in-app + WhatsApp/email)" },
  { value: "mark_overdue_notify_pm", label: "Mark OVERDUE + notify PM" },
  { value: "escalate_ceo", label: "Escalate to CEO/Ops + digest" },
  { value: "schedule_review_lock", label: "Schedule review + lock deadline edits" },
];

interface RuleDraft {
  offsetHours: number;
  action: string;
  enabled: boolean;
}

export default function LadderEditor({
  scopeType,
  scopeId,
  initial,
}: {
  scopeType: string;
  scopeId: string;
  initial: RuleDraft[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<RuleDraft[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update(i: number, patch: Partial<RuleDraft>) {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const sorted = [...rules].sort((a, b) => a.offsetHours - b.offsetHours);
    const res = await fetch("/api/admin/escalation-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType,
        scopeId,
        rules: sorted.map((r, i) => ({ ...r, level: i + 1 })),
      }),
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
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-xs font-bold text-slate-400">L{i + 1}</span>
            <span className="text-sm">T</span>
            <input
              type="number"
              className="input w-20"
              value={rule.offsetHours}
              onChange={(e) => update(i, { offsetHours: Number(e.target.value) })}
            />
            <span className="text-sm text-slate-500">h →</span>
            <select className="input max-w-xs flex-1" value={rule.action} onChange={(e) => update(i, { action: e.target.value })}>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={rule.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} className="accent-brand-600" />
              enabled
            </label>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">Negative offset = before the deadline (T−24h is -24). Rules re-sort by offset on save.</p>
      <div className="mt-3 flex items-center gap-3">
        {dirty && (
          <button onClick={save} className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save ladder"}
          </button>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
