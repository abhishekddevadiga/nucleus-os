"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Upload the CA-issued invoice (PDF/image) against an invoice record.
export default function InvoiceFileUpload({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    if (!input.files?.length) return;
    setBusy(true);
    setError(null);
    const data = new FormData();
    data.append("file", input.files[0]);
    const res = await fetch(`/api/invoices/${invoiceId}/file`, { method: "POST", body: data });
    setBusy(false);
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Upload failed.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        required
        className="text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
      />
      <button className="btn-ghost" disabled={busy}>
        {busy ? "Uploading…" : "Upload invoice"}
      </button>
      {error && <p className="w-full text-sm text-rose-600">{error}</p>}
    </form>
  );
}
