import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeProject, canManageProject } from "@/lib/permissions";
import { getProjectHealth } from "@/lib/projects";
import { getWorkload } from "@/lib/workload";
import { Avatar, SectionTitle, EmptyState, StatusPill, DueBadge, PriorityBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import CampaignDetails from "./details";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  if (!(await canSeeProject(user, id))) notFound();

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      business: true,
      owner: true,
      members: { include: { user: true } },
      workstreams: {
        include: { workstream: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } } },
      },
      milestones: { where: { archivedAt: null }, orderBy: { dueDate: "asc" } },
      tasks: {
        where: { archivedAt: null },
        include: { assignee: true, stage: true, workstream: true, campaign: { include: { business: true } } },
        orderBy: { dueDate: "asc" },
      },
      assets: { where: { archivedAt: null }, include: { category: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!campaign) notFound();

  const isManager = await canManageProject(user, id);
  const openTasks = campaign.tasks.filter((t) => !t.completedAt);
  const completedTasks = campaign.tasks.filter((t) => t.completedAt);
  const overdueTasks = openTasks.filter((t) => new Date(t.dueDate) < new Date());

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: `Tasks (${openTasks.length})` },
    { id: "timeline", label: "Timeline" },
    { id: "assets", label: "Assets" },
    ...(isManager ? [{ id: "settings", label: "Settings" }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Campaign Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/businesses/${campaign.business.slug}`} className="text-xs text-slate-500 hover:text-slate-700 mb-2 block">
            ← {campaign.business.name}
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill status={campaign.status} />
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {campaign.campaignType.charAt(0).toUpperCase() + campaign.campaignType.slice(1)}
            </span>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              campaign.priority === "critical"
                ? "bg-red-100 text-red-700"
                : campaign.priority === "high"
                  ? "bg-orange-100 text-orange-700"
                  : campaign.priority === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-600"
            }`}>
              {campaign.priority.charAt(0).toUpperCase() + campaign.priority.slice(1)}
            </span>
          </div>
        </div>
        {isManager && (
          <Link href={`/campaigns/${campaign.id}/edit`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Edit
          </Link>
        )}
      </div>

      {/* Campaign Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{campaign.tasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total tasks</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-emerald-600">{completedTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Completed</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-rose-600">{overdueTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Overdue</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{campaign.milestones.length}</p>
          <p className="text-xs text-slate-500 mt-1">Milestones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/campaigns/${campaign.id}?tab=${t.id}`}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-screen">
        {tab === "overview" && (
          <CampaignDetails campaignId={campaign.id} />
        )}

        {tab === "tasks" && (
          <div className="space-y-4">
            {openTasks.length === 0 ? (
              <EmptyState title="No open tasks" hint="All tasks are completed or archived." />
            ) : (
              <div className="card divide-y divide-slate-100">
                {openTasks.map((t) => (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="block p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{t.title}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{t.workstream.name}</span>
                          <span>· {t.stage.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={6} />
                        <DueBadge due={t.dueDate} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className="space-y-6">
            <section className="card p-6">
              <SectionTitle>Campaign Timeline</SectionTitle>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Start Date</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{fmtDate(campaign.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Target End Date</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{campaign.endDate ? fmtDate(campaign.endDate) : "—"}</p>
                </div>
              </div>
            </section>

            {campaign.milestones.length > 0 && (
              <section className="card p-6">
                <SectionTitle>Milestones</SectionTitle>
                <div className="space-y-3">
                  {campaign.milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-medium text-slate-900">{m.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{fmtDate(m.dueDate)}</p>
                      </div>
                      <StatusPill status={m.status} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "assets" && (
          <div>
            {campaign.assets.length === 0 ? (
              <EmptyState title="No assets linked" hint="Assets related to this campaign will appear here." />
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {campaign.assets.map((a) => (
                  <Link key={a.id} href={`/assets/${a.id}`} className="card p-4 hover:shadow-md transition-shadow">
                    <p className="font-medium text-slate-900 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.category.name}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && isManager && (
          <div className="card p-6">
            <SectionTitle>Campaign Settings</SectionTitle>
            <p className="text-slate-600">Settings and advanced options coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
