import { NextResponse } from "next/server";
import { runEscalationSweep } from "@/lib/escalation";

// External-cron entry point for the escalation engine (serverless deployments).
// The in-process interval in src/instrumentation.ts covers long-lived servers;
// both paths are idempotent. Protect with CRON_SECRET when exposed publicly.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runEscalationSweep();
  return NextResponse.json(result);
}
