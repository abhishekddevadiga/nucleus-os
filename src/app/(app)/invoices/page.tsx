import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatCard, StatusPill, Th, Td, EmptyState, SectionTitle } from "@/components/ui";
import { hasFinanceAccess } from "@/lib/financeGate";
import QuickForm from "@/components/QuickForm";
import { money, moneyCompact, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Money view: billed vs collected vs overdue; invoice list;
// create invoice (milestone flow pre-fills via the project page).
export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isFinance) redirect("/my-work");
  if (!(await hasFinanceAccess())) redirect("/invoices/unlock");

  const invoices = await db.invoice.findMany({
    where: { archivedAt: null },
    include: { client: true, project: true, payments: true, milestone: true },
    orderBy: { issueDate: "desc" },
  });
  const clients = await db.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });

  const external = invoices.filter((i) => !i.isInternal);
  const billed = external.reduce((s, i) => s + i.total, 0);
  const collected = external.reduce((s, i) => s + i.payments.reduce((p, x) => p + x.amount, 0), 0);
  const overdueAmt = external
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.total - i.payments.reduce((p, x) => p + x.amount, 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Money</h1>
        <p className="text-sm text-slate-500">
          Status tracking + receivables. Status tracking and receivables live here. Statutory/compliance filing stays in your accounting tool, synced by invoice number.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Billed (external)" value={moneyCompact(billed)} />
        <StatCard label="Collected" value={moneyCompact(collected)} tone="good" />
        <StatCard label="Outstanding" value={moneyCompact(billed - collected)} tone={billed - collected > 0 ? "warn" : "default"} />
        <StatCard label="Overdue" value={moneyCompact(overdueAmt)} tone={overdueAmt > 0 ? "danger" : "good"} />
      </div>

      <section>
        <SectionTitle>All invoices</SectionTitle>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet." hint="Complete a billable milestone to auto-draft one." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-slate-100">
                <tr><Th>Invoice</Th><Th>Client</Th><Th>Project / milestone</Th><Th>Status</Th><Th>Total</Th><Th>Paid</Th><Th>Due</Th></tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const paid = i.payments.reduce((s, p) => s + p.amount, 0);
                  return (
                    <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <Td>
                        <Link href={`/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.number}</Link>
                        {i.isInternal && <span className="ml-1.5 chip bg-violet-100 text-violet-700">internal</span>}
                      </Td>
                      <Td>{i.client.name}</Td>
                      <Td className="text-xs">{i.project?.name ?? "—"}{i.milestone && ` · ${i.milestone.title}`}</Td>
                      <Td><StatusPill status={i.status} /></Td>
                      <Td>{money(i.total)}</Td>
                      <Td>{paid ? money(paid) : "—"}</Td>
                      <Td>{fmtDate(i.dueDate)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <QuickForm
        title="New invoice (manual)"
        endpoint="/api/invoices"
        submitLabel="Create draft invoice"
        redirectTemplate="/invoices/{id}"
        fields={[
          {
            name: "clientId", label: "Client", type: "select", required: true,
            options: clients.map((c) => ({ value: c.id, label: `${c.name}${c.kind === "internal" ? " (internal)" : ""}` })),
          },
          { name: "lineItems.0.description", label: "Line item", required: true, placeholder: "June retainer" },
          { name: "lineItems.0.amount", label: "Amount (pre-tax)", type: "number", required: true, min: 0 },
          { name: "taxPercent", label: "Tax %", type: "number", defaultValue: 18, min: 0, step: 0.1 },
          { name: "dueDate", label: "Due date", type: "date", required: true },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
      />
    </div>
  );
}
