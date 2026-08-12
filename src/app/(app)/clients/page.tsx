import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { KindBadge, SectionTitle } from "@/components/ui";
import QuickForm from "@/components/QuickForm";

export const dynamic = "force-dynamic";

// The org tree: Company → Division → Client. Internal brands and
// products are clients — launching a new business is "+ Add client" here.
export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const divisions = await db.division.findMany({
    where: { archivedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      clients: {
        where: { archivedAt: null },
        orderBy: [{ kind: "desc" }, { name: "asc" }],
        include: {
          projects: { where: { archivedAt: null, status: "active" }, select: { id: true } },
          _count: { select: { assets: true, deals: true } },
        },
      },
    },
  });

  const canAdd = user.isCeo || user.isLead || user.isSales;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Businesses</h1>
        <p className="text-sm text-slate-500">
          Every business you run or serve — external clients and internal brands or products, in one tree.
        </p>
      </header>

      {divisions.map((division) => (
        <section key={division.id}>
          <SectionTitle>{division.name}</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {division.clients.map((client) => (
              <Link key={client.id} href={`/clients/${client.slug}`} className="card block p-4 transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{client.name}</p>
                  <KindBadge kind={client.kind} />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {client.projects.length} active project(s) · {client._count.assets} asset(s)
                  {client.kind === "external" && client.contactName ? ` · ${client.contactName}` : ""}
                </p>
              </Link>
            ))}
            {division.clients.length === 0 && (
              <p className="card px-4 py-6 text-center text-sm text-slate-400">No businesses here yet.</p>
            )}
          </div>
        </section>
      ))}

      {canAdd && (
        <QuickForm
          title="Add a business (client, brand or product)"
          endpoint="/api/clients"
          submitLabel="Create business"
          redirectTemplate="/clients/{slug}"
          fields={[
            { name: "name", label: "Name", required: true, placeholder: "e.g. Northwind Studio" },
            {
              name: "divisionId",
              label: "Division",
              type: "select",
              required: true,
              options: divisions.map((d) => ({ value: d.id, label: d.name })),
            },
            {
              name: "kind",
              label: "Kind",
              type: "select",
              required: true,
              options: [
                { value: "internal", label: "Internal (own brand / product)" },
                { value: "external", label: "External (billed client)" },
              ],
            },
            { name: "contactName", label: "Contact name" },
            { name: "contactEmail", label: "Contact email", type: "email" },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      )}
    </div>
  );
}
