import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatusPill, SectionTitle } from "@/components/ui";
import QuickForm from "@/components/QuickForm";
import InvoiceFileUpload from "@/components/InvoiceFileUpload";
import { hasFinanceAccess } from "@/lib/financeGate";
import { money, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isFinance) redirect("/my-work");
  if (!(await hasFinanceAccess())) redirect("/invoices/unlock");
  const { id } = await params;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { client: true, project: true, milestone: true, payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!invoice) notFound();

  const lineItems: { description: string; amount: number }[] = JSON.parse(invoice.lineItems);
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.total - paid;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Link href="/invoices" className="hover:underline">Money</Link> / {invoice.number}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold">{invoice.number}</h1>
          <StatusPill status={invoice.status} />
          {invoice.isInternal && <span className="chip bg-violet-100 text-violet-700">internal cost-tracking</span>}
        </div>
        <p className="text-sm text-slate-500">
          {invoice.client.name}
          {invoice.project && <> · {invoice.project.name}</>}
          {invoice.milestone && <> · milestone “{invoice.milestone.title}”</>}
        </p>
      </header>

      <div className="card p-5">
        <table className="w-full">
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-2 text-sm">{li.description}</td>
                <td className="py-2 text-right text-sm font-medium">{money(li.amount)}</td>
              </tr>
            ))}
            <tr><td className="py-2 text-sm text-slate-500">Subtotal</td><td className="py-2 text-right text-sm">{money(invoice.subtotal)}</td></tr>
            <tr><td className="py-2 text-sm text-slate-500">Tax {invoice.taxPercent}%</td><td className="py-2 text-right text-sm">{money(invoice.total - invoice.subtotal)}</td></tr>
            <tr className="border-t border-slate-200">
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right font-bold">{money(invoice.total)}</td>
            </tr>
            <tr><td className="py-1 text-sm text-emerald-600">Paid</td><td className="py-1 text-right text-sm text-emerald-600">{money(paid)}</td></tr>
            <tr><td className="py-1 text-sm text-rose-600">Balance</td><td className="py-1 text-right text-sm font-semibold text-rose-600">{money(balance)}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-400">
          Issued {fmtDate(invoice.issueDate)} · due {fmtDate(invoice.dueDate)} · auto-flags overdue when unpaid past due
        </p>
        {invoice.notes && <p className="mt-2 text-sm text-slate-500">{invoice.notes}</p>}
      </div>

      <div className="card p-4">
        <SectionTitle>CA-issued invoice file</SectionTitle>
        {invoice.filePath ? (
          <p className="mb-3 text-sm">
            📄{" "}
            <a href={`/api/files/${invoice.filePath}`} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
              {invoice.fileName ?? invoice.filePath} ↗
            </a>
            <span className="ml-2 text-xs text-slate-400">uploading again replaces it</span>
          </p>
        ) : (
          <p className="mb-3 text-sm text-slate-400">
            No file yet — upload the invoice your CA issued (PDF or image). This system tracks status; the CA copy is the compliance document.
          </p>
        )}
        <InvoiceFileUpload invoiceId={invoice.id} />
      </div>

      {invoice.status === "draft" && (
        <QuickForm
          alwaysOpen
          endpoint={`/api/invoices/${invoice.id}`}
          method="PATCH"
          submitLabel="Mark as sent"
          extra={{ status: "sent" }}
          fields={[]}
        />
      )}

      {balance > 0 && invoice.status !== "draft" && (
        <QuickForm
          title="Record payment"
          endpoint={`/api/invoices/${invoice.id}`}
          method="PATCH"
          submitLabel="Record payment"
          fields={[
            { name: "payment.amount", label: "Amount", type: "number", required: true, min: 1, defaultValue: balance },
            { name: "payment.method", label: "Method", placeholder: "Bank transfer / UPI" },
            { name: "payment.reference", label: "Reference (UTR…)" },
          ]}
        />
      )}

      {invoice.payments.length > 0 && (
        <section>
          <SectionTitle>Payments</SectionTitle>
          <div className="card">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-50 px-4 py-2.5 text-sm last:border-0">
                <span>{fmtDate(p.paidAt)} · {p.method ?? "—"} {p.reference && <span className="text-slate-400">({p.reference})</span>}</span>
                <span className="font-semibold text-emerald-600">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
