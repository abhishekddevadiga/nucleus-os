import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SectionTitle, Avatar } from "@/components/ui";
import { ROLE_LABELS, ESCALATION_ACTION_LABELS } from "@/lib/constants";
import { AddUserModal } from "./AddUserModal";
import { AddDepartmentModal } from "./AddDepartmentModal";
import { AddAssetCategoryModal } from "./AddAssetCategoryModal";
import { AddEscalationRuleModal } from "./AddEscalationRuleModal";
import { AddWorkstreamModal } from "./AddWorkstreamModal";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; action?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isOwner) redirect("/my-work");
  const { tab = "workstreams", action } = await searchParams;

  const [workstreams, rules, users, templates, departments, assetCategories] = await Promise.all([
    db.workstream.findMany({
      where: { archivedAt: null },
      orderBy: { sortOrder: "asc" },
      include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
    }),
    db.escalationRule.findMany({ orderBy: { level: "asc" } }),
    db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, include: { roleAssignments: true } }),
    db.campaignTemplate.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.assetCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const orgRules = rules.filter((r) => r.scopeType === "organization");

  const tabs = [
    ["workstreams", `Workstreams (${workstreams.length})`],
    ["escalations", "Escalation rules"],
    ["users", `Users (${users.length})`],
    ["departments", `Departments (${departments.length})`],
    ["templates", `Templates (${templates.length})`],
    ["categories", `Asset Categories (${assetCategories.length})`],
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-slate-500">Workstreams, escalation rules, people, departments, and templates — config, not code.</p>
      </header>
      <nav className="flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <Link key={key} href={`/admin?tab=${key}`} className={`tab ${tab === key ? "tab-active" : ""}`}>{label}</Link>
        ))}
      </nav>

      {tab === "workstreams" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Workstreams</SectionTitle>
              <p className="text-sm text-slate-600">Pipeline stages at organization level. Each business can use these workstreams.</p>
            </div>
            <Link href="/admin?tab=workstreams&action=add" className="btn-primary">+ Add Workstream</Link>
          </div>
          <div className="space-y-3">
            {workstreams.map((v) => (
              <div key={v.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{v.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.stages.map((s) => (
                        <span key={s.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{s.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "escalations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Escalation Ladder</SectionTitle>
              <p className="text-sm text-slate-600">Default rules at organization scope. Task deadlines trigger these actions.</p>
            </div>
            <Link href="/admin?tab=escalations&action=add" className="btn-primary">+ Add Rule</Link>
          </div>
          <div className="space-y-3">
            {orgRules.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      T+{r.offsetHours}h: {ESCALATION_ACTION_LABELS[r.action as keyof typeof ESCALATION_ACTION_LABELS] || r.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Level {r.level}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>People</SectionTitle>
              <p className="text-sm text-slate-600">User accounts and role assignments across the organization.</p>
            </div>
            <Link href="/admin?tab=users&action=add" className="btn-primary">+ Add User</Link>
          </div>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} color={u.avatarColor}  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {u.roleAssignments.map((r) => (
                        <span key={r.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] || r.role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "departments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Departments</SectionTitle>
              <p className="text-sm text-slate-600">Shared team structure.</p>
            </div>
            <Link href="/admin?tab=departments&action=add" className="btn-primary">+ Add Department</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {departments.map((d) => (
              <div key={d.id} className="card p-4">
                <p className="font-semibold text-slate-900">{d.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Campaign Templates</SectionTitle>
              <p className="text-sm text-slate-600">Starter blueprints for new projects.</p>
            </div>
          </div>
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="card p-4">
                <p className="font-semibold text-slate-900">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Asset Categories</SectionTitle>
              <p className="text-sm text-slate-600">Taxonomy for organizing assets across the organization.</p>
            </div>
            <Link href="/admin?tab=categories&action=add" className="btn-primary">+ Add Category</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {assetCategories.map((c) => (
              <div key={c.id} className="card p-4">
                <p className="font-semibold text-slate-900">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {action === "add" && tab === "users" && <AddUserModal />}
      {action === "add" && tab === "departments" && <AddDepartmentModal />}
      {action === "add" && tab === "categories" && <AddAssetCategoryModal />}
      {action === "add" && tab === "escalations" && <AddEscalationRuleModal />}
      {action === "add" && tab === "workstreams" && <AddWorkstreamModal />}
    </div>
  );
}
