"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RevokeClient({ grantId, clientId }: { grantId: string; clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="chip bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/access-grants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revokeId: grantId, clientId }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      Revoke
    </button>
  );
}
