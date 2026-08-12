import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SectionTitle, Avatar } from "@/components/ui";
import QuickForm from "@/components/QuickForm";
import VerticalEditor from "./VerticalEditor";
import LadderEditor from "./LadderEditor";
import { ROLES, ROLE_LABELS, ESCALATION_ACTION_LABELS } from "@/lib/constants";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

// Admin (CEO/Ops only): verticals, escalation ladder, users & roles, templates.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo) redirect("/my-work");
  const { tab = "verticals" } = await searchParams;

  const [company, verticals, rules, users, templates, divisions, clients] = await Promise.all([
    db.company.findFirst(),
    db.vertical.findMany({
      where: { archivedAt: null },
      orderBy: { sortOrder: "asc" },
      include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
    }),
    db.escalationRule.findMany({ orderBy: { level: "asc" } }),
    db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, include: { roleAssignments: true } }),
    db.projectTemplate.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.division.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" } }),
    db.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const companyRules = rules.filter((r) => r.scopeType === "company");

  const scopeName = (scopeType: string, scopeId: string) => {
    if (scopeType === "company") return "Company";
    if (scopeType === "division") return divisions.find((d) => d.id === scopeId)?.name ?? "division";
    if (scopeType === "client") return clients.find((c) => c.id === scopeId)?.name ?? "client";
    return "project";
  };

  const tabs = [
    ["verticals", `Verticals (${verticals.length})`],
    ["escalations", "Escalation rules"],
    ["users", `Users (${users.length})`],
    ["templates", `Templates (${templates.length})`],
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-slate-500">Verticals, escalation rules, people and templates — config, not code.</p>
      </header>
      <nav className="flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/admin?tab=${key}`} className={`tab ${tab === key ? "tab-active" : ""}`}>{label}</Link>
        ))}
      </nav>

      {tab === "verticals" && (
        <div className="space-y-4">
          {verticals.map((v) => (
            <VerticalEditor key={v.id} vertical={{ id: v.id, name: v.name, isSystem: v.isSystem, stages: v.stages }} />
          ))}
          <QuickForm
            title="Create vertical"
            endpoint="/api/admin/verticals"
            submitLabel="Create vertical"
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "e.g. Podcast production" },
              {
                name: "stages.0", label: "Stage 1", required: true, placeholder: "Brief",
              },
              { name: "stages.1", label: "Stage 2", required: true, placeholder: "In progress" },
              { name: "stages.2", label: "Stage 3 (terminal if last)", placeholder: "Delivered" },
              { name: "stages.3", label: "Stage 4" },
              { name: "stages.4", label: "Stage 5" },
              { name: "stages.5", label: "Stage 6" },
            ]}
          />
        </div>
      )}

      {tab === "escalations" && (
        <div className="space-y-4">
          <SectionTitle>Company default ladder</SectionTitle>
          <LadderEditor
            scopeType="company"
            scopeId={company?.id ?? ""}
            initial={companyRules.map((r) => ({ offsetHours: r.offsetHours, action: r.action, enabled: r.enabled }))}
          />
          {rules.filter((r) => r.scopeType !== "company").length > 0 && (
            <>
              <SectionTitle>Scope overrides</SectionTitle>
              <div className="card p-4 text-sm text-slate-600">
                {rules.filter((r) => r.scopeType !== "company").map((r) => (
                  <p key={r.id}>
                    {scopeName(r.scopeType, r.scopeId)} · T{r.offsetHours >= 0 ? "+" : ""}{r.offsetHours}h → {ESCALATION_ACTION_LABELS[r.action] ?? r.action}
                    {!r.enabled && " (disabled)"}
                  </p>
                ))}
              </div>
            </>
          )}
          <p className="text-xs text-slate-400">
            Engine sweeps every 60s (in-process) — or POST /api/cron/escalations from an external cron. Most specific scope wins: project &gt; client &gt; division &gt; company.
          </p>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="card">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                <Avatar name={u.name} color={u.avatarColor} size={7} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{u.name} <span className="font-normal text-slate-400">· {u.email}</span></p>
                  <p className="text-xs text-slate-400">
                    {u.title ?? "—"} · {u.capacityHours}h/week ·{" "}
                    {u.roleAssignments.map((r) => `${ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role} @ ${scopeName(r.scopeType, r.scopeId)}`).join(" · ") || "no roles"}
                  </p>
                </div>
                <Link href={`/people/${u.id}`} className="text-xs text-brand-600 hover:underline">sheet →</Link>
              </div>
            ))}
          </div>
          <QuickForm
            title="Add user"
            endpoint="/api/admin/users"
            submitLabel="Create user"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "password", label: "Password (min 8 chars)", type: "password", required: true },
              { name: "title", label: "Title" },
              { name: "capacityHours", label: "Weekly capacity (h)", type: "number", defaultValue: 40, min: 0 },
              {
                name: "role", label: "Role", type: "select", required: true,
                options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
              },
              {
                name: "scopeType", label: "Scope type", type: "select", required: true, defaultValue: "company",
                options: [
                  { value: "company", label: "Company" },
                  { value: "division", label: "Division" },
                  { value: "client", label: "Client" },
                ],
              },
              {
                name: "scopeId", label: "Scope (company/division/client id)", type: "select", required: true,
                defaultValue: company?.id,
                options: [
                  { value: company?.id ?? "", label: `Company — ${BRAND.name}` },
                  ...divisions.map((d) => ({ value: d.id, label: `Division — ${d.name}` })),
                  ...clients.map((c) => ({ value: c.id, label: `Client — ${c.name}` })),
                ],
              },
            ]}
          />
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          {templates.map((t) => {
            const cfg = JSON.parse(t.config) as { verticals: string[]; milestones?: unknown[]; tasks?: unknown[] };
            return (
              <div key={t.id} className="card p-4">
                <p className="font-semibold">{t.name} <span className="text-xs font-normal text-slate-400">({t.key})</span></p>
                <p className="text-sm text-slate-500">{t.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Verticals: {cfg.verticals.join(", ")} · {cfg.milestones?.length ?? 0} milestone(s) · {cfg.tasks?.length ?? 0} templated task(s)
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">Edit config JSON</summary>
                  <div className="mt-2">
                    <QuickForm
                      alwaysOpen
                      endpoint="/api/admin/templates"
                      submitLabel="Save template"
                      extra={{ id: t.id }}
                      fields={[
                        { name: "name", label: "Name", required: true, defaultValue: t.name },
                        { name: "description", label: "Description", defaultValue: t.description ?? "" },
                        { name: "config", label: "Config (JSON)", type: "textarea", required: true, defaultValue: t.config },
                      ]}
                    />
                  </div>
                </details>
              </div>
            );
          })}
          <QuickForm
            title="New template"
            endpoint="/api/admin/templates"
            submitLabel="Create template"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "description", label: "Description" },
              {
                name: "config", label: "Config (JSON)", type: "textarea", required: true,
                defaultValue: '{"verticals":["strategy","change-requests"],"milestones":[{"title":"Kickoff done","offsetDays":7,"billable":false}],"tasks":[{"title":"Kickoff workshop","vertical":"strategy","offsetDays":3,"estimateHours":4,"priority":"high"}]}',
                hint: "verticals: slugs · milestones/tasks: offsetDays relative to project start",
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
