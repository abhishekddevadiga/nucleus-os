// Next.js instrumentation hook — starts the in-process escalation scheduler
// when the server boots. Rules must fire within 5 minutes of trigger time
//; we sweep every 60 seconds. For serverless deployments where a
// long-lived process isn't available, hit POST /api/cron/escalations from an
// external cron instead (idempotent either way).

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __escalationTimer?: ReturnType<typeof setInterval> };
  if (g.__escalationTimer) return;

  const { runEscalationSweep } = await import("./lib/escalation");
  const sweep = async () => {
    try {
      const res = await runEscalationSweep();
      if (res.fired > 0) console.log(`[escalation-engine] fired ${res.fired} rule(s) across ${res.checked} open tasks`);
    } catch (err) {
      console.error("[escalation-engine] sweep failed:", err);
    }
  };
  g.__escalationTimer = setInterval(sweep, 60_000);
  // First sweep shortly after boot (let the DB connection settle).
  setTimeout(sweep, 3_000);
}
