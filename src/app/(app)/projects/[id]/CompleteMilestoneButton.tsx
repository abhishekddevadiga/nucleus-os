"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompleteMilestoneButton({ milestoneId, billable }: { milestoneId: string; billable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/milestones/${milestoneId}/complete`, { method: "POST" });
        setBusy(false);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.invoiceId) router.push(`/invoices/${data.invoiceId}`);
          else router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error ?? "Failed.");
        }
      }}
    >
      {billable ? "Complete → draft invoice" : "Mark complete"}
    </button>
  );
}
