import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { KindBadge, SectionTitle, EmptyState, StatusPill, Avatar, Th, Td } from "@/components/ui";
import QuickForm from "@/components/QuickForm";
import { fmtDate, money, moneyCompact } from "@/lib/format";
import { ASSET_TYPES } from "@/lib/constants";
import RevokeClient from "./RevokeClient";

export const dynamic = "force-dynamic";

// Client home: overview + projects + Asset Hub + Brand Kit + Access Vault +
// invoices. Same machinery for internal and external.
export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const { tab = "overview" } = await searchParams;

  const client = await db.client.findUnique({
    where: { slug },
    include: {
      division: true,
      brandKit: true,
      projects: {
        where: { archivedAt: null },
        include: { owner: true, tasks: { where: { archivedAt: null, completedAt: null }, select: { id: true, dueDate: true } } },
        orderBy: { createdAt: "desc" },
      },
      assets: {
        where: { archivedAt: null },
        include: { registeredBy: true, parentAsset: true, project: true, vertical: true },
        orderBy: { createdAt: "desc" },
      },
      accessGrants: { include: { user: true }, orderBy: { grantedAt: "desc" } },
      invoices: { where: { archivedAt: null }, include: { payments: true }, orderBy: { issueDate: "desc" } },
      deals: { where: { archivedAt: null }, orderBy: { lastActivityAt: "desc" } },
    },
  });
  if (!client || client.archivedAt) notFound();

  const people = await db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  const now = new Date();
  const colors: { name: string; hex: string }[] = client.brandKit?.colors ? JSON.parse(client.brandKit.colors) : [];

  const tabs = [
    ["overview", "Overview"],
    ["assets", `Asset Hub (${client.assets.length})`],
    ["brandkit", "Brand Kit"],
    ["access", `Access Vault (${client.accessGrants.filter((g) => !g.revokedAt).length})`],
    ["invoices", `Invoices (${client.invoices.length})`],
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Link href="/clients" className="hover:underline">Businesses</Link> / {client.division.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <KindBadge kind={client.kind} />
        </div>
        {client.contactName && (
          <p className="text-sm text-slate-500">{client.contactName} · {client.contactEmail}</p>
        )}
      </header>

      <nav className="flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/clients/${client.slug}?tab=${key}`} className={`tab ${tab === key ? "tab-active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <section>
            <SectionTitle action={<Link href={`/projects/new?client=${client.id}`} className="btn-primary">+ New project</Link>}>
              Projects
            </SectionTitle>
            {client.projects.length === 0 ? (
              <EmptyState title="No projects yet." hint="Create one from a template — verticals, milestones and tasks come pre-attached." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {client.projects.map((p) => {
                  const overdue = p.tasks.filter((t) => t.dueDate < now).length;
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} className="card block p-4 hover:-translate-y-0.5 transition-transform">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{p.name}</p>
                        <StatusPill status={p.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        PM {p.owner.name} · {p.tasks.length} open task(s)
                        {overdue > 0 && <span className="font-semibold text-rose-600"> · {overdue} overdue</span>}
                        {p.value > 0 && ` · ${moneyCompact(p.value)}`}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          {client.deals.length > 0 && (
            <section>
              <SectionTitle>Deals</SectionTitle>
              <div className="card">
                {client.deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 border-b border-slate-50 px-4 py-2.5 last:border-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-slate-400">{moneyCompact(d.value)} · <StatusPill status={d.stage} /></p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {client.notes && (
            <section>
              <SectionTitle>Notes</SectionTitle>
              <div className="card p-4 text-sm text-slate-600 whitespace-pre-wrap">{client.notes}</div>
            </section>
          )}
        </div>
      )}

      {tab === "assets" && (
        <div className="space-y-4">
          <QuickForm
            title="Register asset (link + metadata)"
            endpoint="/api/assets"
            submitLabel="Register asset"
            extra={{ clientId: client.id }}
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "Hero film — master v2" },
              { name: "url", label: "Link (Drive/Dropbox/Frame.io)", type: "url", required: true },
              {
                name: "type", label: "Type", type: "select", required: true,
                options: ASSET_TYPES.map((t) => ({ value: t, label: t })),
              },
              {
                name: "projectId", label: "Project", type: "select",
                options: client.projects.map((p) => ({ value: p.id, label: p.name })),
              },
              {
                name: "parentAssetId", label: "Derived from (asset chain)", type: "select",
                options: client.assets.map((a) => ({ value: a.id, label: a.name })),
              },
              { name: "tags", label: "Tags (comma-separated)" },
            ]}
          />
          {client.assets.length === 0 ? (
            <EmptyState title="Asset hub is empty." hint="Register links to Drive/Dropbox with type + tags. Chaining: footage → master → variations." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-slate-100">
                  <tr><Th>Asset</Th><Th>Type</Th><Th>Project</Th><Th>Chain</Th><Th>By</Th><Th>Deliverable</Th><Th>Added</Th></tr>
                </thead>
                <tbody>
                  {client.assets.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <Td>
                        <a href={a.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                          {a.name} ↗
                        </a>
                        {a.tags && <p className="text-xs text-slate-400">{a.tags}</p>}
                      </Td>
                      <Td><span className="chip bg-slate-100 text-slate-600">{a.type}</span></Td>
                      <Td>{a.project?.name ?? "—"}</Td>
                      <Td className="text-xs">{a.parentAsset ? `↳ from ${a.parentAsset.name}` : "—"}</Td>
                      <Td>{a.registeredBy.name}</Td>
                      <Td>{a.isDeliverable ? <span className="chip bg-emerald-100 text-emerald-700">✓ delivered</span> : "—"}</Td>
                      <Td>{fmtDate(a.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "brandkit" && (
        <div className="space-y-4">
          <div className="card p-5">
            <SectionTitle>Brand kit — pinned for everyone working on {client.name}</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="label">Colors</p>
                {colors.length ? (
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <span key={c.hex} className="chip border border-slate-200" title={c.hex}>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.hex }} /> {c.name} {c.hex}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not set.</p>
                )}
              </div>
              <div>
                <p className="label">Fonts</p>
                <p className="text-sm text-slate-600">{client.brandKit?.fonts ?? "Not set."}</p>
              </div>
              <div>
                <p className="label">Logo</p>
                {client.brandKit?.logoUrl ? (
                  <a className="text-sm text-brand-700 hover:underline" href={client.brandKit.logoUrl} target="_blank" rel="noreferrer">Logo pack ↗</a>
                ) : (
                  <p className="text-sm text-slate-400">Not set.</p>
                )}
              </div>
              <div>
                <p className="label">Tone of voice</p>
                {client.brandKit?.toneOfVoiceUrl ? (
                  <a className="text-sm text-brand-700 hover:underline" href={client.brandKit.toneOfVoiceUrl} target="_blank" rel="noreferrer">Doc ↗</a>
                ) : (
                  <p className="text-sm text-slate-600">{client.brandKit?.notes ?? "Not set."}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="label">Do / Don&apos;t</p>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{client.brandKit?.dosAndDonts ?? "Not set."}</p>
              </div>
            </div>
          </div>
          <QuickForm
            title="Edit brand kit"
            endpoint={`/api/clients/${client.id}/brandkit`}
            method="PATCH"
            submitLabel="Save brand kit"
            fields={[
              { name: "logoUrl", label: "Logo pack URL", type: "url", defaultValue: client.brandKit?.logoUrl ?? "" },
              { name: "fonts", label: "Fonts", defaultValue: client.brandKit?.fonts ?? "" },
              { name: "toneOfVoiceUrl", label: "Tone-of-voice doc URL", type: "url", defaultValue: client.brandKit?.toneOfVoiceUrl ?? "" },
              {
                name: "colors", label: "Colors (JSON)", type: "textarea",
                defaultValue: client.brandKit?.colors ?? "",
                hint: 'e.g. [{"name":"Rose","hex":"#d46a8c"}]',
              },
              { name: "dosAndDonts", label: "Do / Don't", type: "textarea", defaultValue: client.brandKit?.dosAndDonts ?? "" },
              { name: "notes", label: "Notes", type: "textarea", defaultValue: client.brandKit?.notes ?? "" },
            ]}
          />
        </div>
      )}

      {tab === "access" && (
        <div className="space-y-4">
          <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
            The vault records <strong>who has access to what</strong> — ad accounts, pages, domains, repos. Never passwords.
          </p>
          <QuickForm
            title="Grant access"
            endpoint="/api/access-grants"
            submitLabel="Record grant"
            extra={{ clientId: client.id }}
            fields={[
              {
                name: "userId", label: "Person", type: "select", required: true,
                options: people.map((p) => ({ value: p.id, label: p.name })),
              },
              { name: "property", label: "Property", required: true, placeholder: "Meta Ads account" },
              { name: "notes", label: "Notes", placeholder: "Admin / read-only…" },
            ]}
          />
          {client.accessGrants.length === 0 ? (
            <EmptyState title="No access recorded." />
          ) : (
            <div className="card">
              {client.accessGrants.map((g) => (
                <div key={g.id} className={`flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-0 ${g.revokedAt ? "opacity-50" : ""}`}>
                  <Avatar name={g.user.name} color={g.user.avatarColor} size={6} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{g.user.name} → {g.property}</p>
                    <p className="text-xs text-slate-400">
                      {g.notes ? `${g.notes} · ` : ""}granted {fmtDate(g.grantedAt)}
                      {g.revokedAt && ` · revoked ${fmtDate(g.revokedAt)}`}
                    </p>
                  </div>
                  {!g.revokedAt && <RevokeButton grantId={g.id} clientId={client.id} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-4">
          {client.kind === "internal" && (
            <p className="rounded-lg bg-violet-50 px-4 py-2 text-xs text-violet-700">
              Internal client — invoices here are zero-value/cost-tracking so product P&amp;L stays visible.
            </p>
          )}
          {client.invoices.length === 0 ? (
            <EmptyState title="No invoices." hint="Complete a billable milestone to auto-draft one, or create from the Money view." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-slate-100">
                  <tr><Th>Invoice</Th><Th>Status</Th><Th>Total</Th><Th>Paid</Th><Th>Issued</Th><Th>Due</Th></tr>
                </thead>
                <tbody>
                  {client.invoices.map((inv) => {
                    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <Td><Link href={`/invoices/${inv.id}`} className="font-medium text-brand-700 hover:underline">{inv.number}</Link></Td>
                        <Td><StatusPill status={inv.status} /></Td>
                        <Td>{money(inv.total)}</Td>
                        <Td>{money(paid)}</Td>
                        <Td>{fmtDate(inv.issueDate)}</Td>
                        <Td>{fmtDate(inv.dueDate)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RevokeButton({ grantId, clientId }: { grantId: string; clientId: string }) {
  return <RevokeClient grantId={grantId} clientId={clientId} />;
}
