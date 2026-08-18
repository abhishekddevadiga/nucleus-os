"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { value: "remind_assignee", label: "Remind Assignee" },
  { value: "mark_overdue_notify_pm", label: "Mark Overdue & Notify PM" },
  { value: "escalate_owner", label: "Escalate to Owner" },
  { value: "schedule_review_lock", label: "Schedule Review & Lock" },
];

export function AddEscalationRuleModal() {
  const router = useRouter();
  const [offsetHours, setOffsetHours] = useState<string>("-24");
  const [action, setAction] = useState("remind_assignee");
  const [level, setLevel] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/escalation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offsetHours: parseInt(offsetHours),
          action,
          level: parseInt(level),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create rule");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/admin?tab=escalations");
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-full max-w-[400px] p-6 shadow-lg">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Add Escalation Rule</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Offset Hours</label>
            <input
              type="number"
              className="input"
              value={offsetHours}
              onChange={(e) => setOffsetHours(e.target.value)}
              placeholder="-24"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Negative = before due date</p>
          </div>

          <div>
            <label className="label">Action</label>
            <select
              className="input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              required
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Level</label>
            <input
              type="number"
              className="input"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="1"
              min="1"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
