// One-off escalation sweep from the CLI (useful for external cron on hosts
// without long-lived processes): npm run escalations:run
import { runEscalationSweep } from "../src/lib/escalation";

runEscalationSweep()
  .then((res) => {
    console.log(`Escalation sweep: fired ${res.fired} rule(s) across ${res.checked} open task(s).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Sweep failed:", err);
    process.exit(1);
  });
