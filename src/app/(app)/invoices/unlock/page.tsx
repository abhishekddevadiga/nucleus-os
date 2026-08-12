"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FinanceUnlockPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/finance/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace("/invoices");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Wrong password.");
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center">
      <div className="card w-full p-6">
        <p className="text-3xl">🔒</p>
        <h1 className="mt-2 text-xl font-bold">Finance is locked</h1>
        <p className="mt-1 text-sm text-slate-500">
          The Money section holds invoices and receivables. Enter the finance password to continue — access re-locks after 8 hours.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Finance password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
