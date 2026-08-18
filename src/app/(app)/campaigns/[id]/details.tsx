import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar, SectionTitle, HealthBadge, StatusPill, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function CampaignDetails({ campaignId }: { campaignId: string }) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      business: true,
      owner: true,
      members: { include: { user: true } },
      milestones: { orderBy: { dueDate: "asc" } },
      tasks: {
        where: { archivedAt: null },
        include: { assignee: true, workstream: true, stage: true },
        orderBy: { dueDate: "asc" },
        take: 10,
      },
      assets: {
        where: { archivedAt: null },
        include: { category: true },
        take: 8,
      },
    },
  });

  if (!campaign) return null;

  const openTasks = campaign.tasks.filter((t) => !t.completedAt);
  const completedTasks = campaign.tasks.filter((t) => t.completedAt);
  const overdueTasks = openTasks.filter((t) => new Date(t.dueDate) < new Date());
  const now = new Date();

  return (
    <div className="space-y-8">
      {/* Campaign Header */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill status={campaign.status} />
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {campaign.campaignType}
              </span>
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                campaign.priority === "critical"
                  ? "bg-red-100 text-red-700"
                  : campaign.priority === "high"
                    ? "bg-orange-100 text-orange-700"
                    : campaign.priority === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-slate-100 text-slate-600"
              }`}>
                {campaign.priority}
              </span>
            </div>
          </div>
          <Link href={`/campaigns/${campaign.id}/edit`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Edit Campaign
          </Link>
        </div>
      </section>

      {/* Campaign Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{campaign.tasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total tasks</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{completedTasks.length}</p>
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

      {/* Objective & Description */}
      {campaign.objective && (
        <section className="card p-6">
          <SectionTitle>Campaign Objective</SectionTitle>
          <p className="text-slate-700">{campaign.objective}</p>
        </section>
      )}

      {campaign.description && (
        <section className="card p-6">
          <SectionTitle>Campaign Brief</SectionTitle>
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{campaign.description}</div>
        </section>
      )}

      {campaign.goals && (
        <section className="card p-6">
          <SectionTitle>Success Metrics</SectionTitle>
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{campaign.goals}</div>
        </section>
      )}

      {/* Timeline */}
      <section className="card p-6">
        <SectionTitle>Timeline</SectionTitle>
        <div className="grid gap-4 grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Start Date</p>
            <p className="text-sm font-medium text-slate-900">{fmtDate(campaign.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Target End Date</p>
            <p className="text-sm font-medium text-slate-900">{campaign.endDate ? fmtDate(campaign.endDate) : "—"}</p>
          </div>
        </div>
      </section>

      {/* Milestones */}
      {campaign.milestones.length > 0 && (
        <section className="card p-6">
          <SectionTitle>Milestones</SectionTitle>
          <div className="space-y-3">
            {campaign.milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-500">{fmtDate(m.dueDate)}</p>
                </div>
                <StatusPill status={m.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team */}
      {campaign.members.length > 0 && (
        <section className="card p-6">
          <SectionTitle>Team Members</SectionTitle>
          <div className="space-y-2">
            {campaign.members.map((m) => (
              <Link key={m.id} href={`/people/${m.user.id}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                <Avatar name={m.user.name} color={m.user.avatarColor} size={6} />
                <span className="text-sm font-medium text-slate-900">{m.user.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Tasks */}
      {openTasks.length > 0 && (
        <section className="card p-6">
          <SectionTitle>Open Tasks ({openTasks.length})</SectionTitle>
          <div className="divide-y divide-slate-100">
            {openTasks.slice(0, 5).map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 py-3 px-2 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.workstream.name} · {t.stage.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={t.assignee.name} color={t.assignee.avatarColor} size={6} />
                  <span className={`text-xs px-2 py-1 rounded ${
                    new Date(t.dueDate) < now
                      ? "bg-rose-100 text-rose-700"
                      : new Date(t.dueDate).getTime() - now.getTime() < 24 * 60 * 60 * 1000
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}>
                    {fmtDate(t.dueDate)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {openTasks.length > 5 && (
            <Link href={`/campaigns/${campaign.id}?tab=tasks`} className="block mt-3 text-sm text-brand-600 hover:underline">
              View all {openTasks.length} tasks →
            </Link>
          )}
        </section>
      )}

      {/* Assets */}
      {campaign.assets.length > 0 && (
        <section className="card p-6">
          <SectionTitle>Assets & Resources</SectionTitle>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {campaign.assets.map((a) => (
              <Link key={a.id} href={`/assets/${a.id}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-500">{a.category.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
