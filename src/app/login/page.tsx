"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed.");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      {/* ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-14%] h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[130px]"
        style={{ background: "radial-gradient(circle, #d4a574, transparent 70%)" }}
      />
      <div className="animate-page relative w-full max-w-[380px]">
        <div className="mb-9 flex flex-col items-center text-center">
          <img src="/logo.svg" alt="" className="mb-5 h-14 w-14 rounded-2xl object-contain shadow-soft" />
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Get started</h1>
          <p className="mt-2 text-[14px] text-slate-500">Sign in to {BRAND.productName}</p>
        </div>

        <form onSubmit={submit} className="card space-y-5 p-7 shadow-lift">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${BRAND.emailDomain}`}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {error}
            </p>
          )}
          <button className="btn-primary h-11 w-full text-sm" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] leading-relaxed text-slate-400">
          First run? Sign in with the admin account created by{" "}
          <span className="font-mono text-slate-500">npm run db:setup</span>.
        </p>
      </div>
    </main>
  );
}
