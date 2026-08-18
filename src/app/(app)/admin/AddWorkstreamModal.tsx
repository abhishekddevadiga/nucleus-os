"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_STAGES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Review",
  "Done",
];

export function AddWorkstreamModal() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES);
  const [stageInput, setStageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStage() {
    if (stageInput.trim()) {
      setStages([...stages, stageInput.trim()]);
      setStageInput("");
    }
  }

  function removeStage(index: number) {
    setStages(stages.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/workstreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stages }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create workstream");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/admin?tab=workstreams");
    } catch (err) {
      setError("An error occurred");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="card w-full max-w-[400px] p-6 shadow-lg m-4">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Add Workstream</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Workstream Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Design Pipeline"
              required
            />
          </div>

          <div>
            <label className="label">Pipeline Stages</label>
            <div className="space-y-2">
              {stages.map((stage, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded">
                  <span className="text-sm text-slate-700">{stage}</span>
                  <button
                    type="button"
                    onClick={() => removeStage(idx)}
                    className="text-xs text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="input flex-1"
                value={stageInput}
                onChange={(e) => setStageInput(e.target.value)}
                placeholder="Add stage name"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStage();
                  }
                }}
              />
              <button
                type="button"
                onClick={addStage}
                className="btn-subtle"
              >
                Add
              </button>
            </div>
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
              disabled={loading || !name || stages.length === 0}
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
