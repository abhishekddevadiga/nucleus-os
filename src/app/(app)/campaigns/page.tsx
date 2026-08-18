import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleCampaignIds, projectWhere } from "@/lib/permissions";
import { StatusPill, EmptyState, DueBadge } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ show?: string; business?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { show, business } = await searchParams;
  const showArchived = show === "archived";

  const visible = await getVisibleCampaignIds(user);
  const campaigns = await db.campaign.findMany({
    where: {
      ...projectWhere(visible),
      ...(showArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(business ? { businessId: business } : {}),
    },
    include: {
      business: true,
      owner: true,
      tasks: { where: { archivedAt: null }, select: { id: true, dueDate: true, completedAt: true } },
      milestones: { select: { id: true, dueDate: true } },
      members: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const businesses = await db.business.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">
            {showArchived ? "Archived campaigns" : "Active campaigns across all businesses"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={showArchived ? "/campaigns" : "/campaigns?show=archived"} className="btn-ghost">
            {showArchived ? "Show active" : "Show archived"}
          </Link>
          <Link href="/campaigns/new" className="btn-primary">+ New Campaign</Link>
        </div>
      </header>

      {/* Business Filter */}
      {businesses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Link
            href="/campaigns"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !business
                ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Businesses
          </Link>
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/campaigns?business=${b.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                business === b.id
                  ? "bg-brand-100 text-brand-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived campaigns" : "No campaigns yet"}
          hint={showArchived ? "Archived campaigns will appear here." : "Create your first campaign to organize your work."}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const openTasks = c.tasks.filter((t) => !t.completedAt);
            const completedTasks = c.tasks.filter((t) => t.completedAt);
            const overdueTasks = openTasks.filter((t) => t.dueDate < now);
            const upcomingMilestones = c.milestones.filter((m) => new Date(m.dueDate) > now);

            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="card p-5 hover:shadow-md transition-shadow group"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-brand-600">{c.name}</h3>
                    <Link
                      href={`/businesses/${c.business.slug}`}
                      className="text-xs text-slate-500 hover:text-slate-700 mt-0.5 inline-block"
                    >
                      {c.business.name}
                    </Link>
                  </div>
                  <StatusPill status={c.status} />
                </div>

                <div className="mb-3 flex flex-wrap gap-1">
                  <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {c.campaignType}
                  </span>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.priority === "critical"
                      ? "bg-red-100 text-red-700"
                      : c.priority === "high"
                        ? "bg-orange-100 text-orange-700"
                        : c.priority === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-slate-100 text-slate-600"
                  }`}>
                    {c.priority}
                  </span>
                </div>

                {/* Stats */}
                <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded bg-slate-50 px-2 py-1.5">
                    <p className="text-xs text-slate-500">Tasks</p>
                    <p className="font-semibold text-slate-900">{completedTasks.length}/{c.tasks.length}</p>
                  </div>
                  <div className={`rounded px-2 py-1.5 ${
                    overdueTasks.length > 0
                      ? "bg-rose-50"
                      : "bg-slate-50"
                  }`}>
                    <p className="text-xs text-slate-500">Overdue</p>
                    <p className={`font-semibold ${
                      overdueTasks.length > 0
                        ? "text-rose-600"
                        : "text-slate-900"
                    }`}>
                      {overdueTasks.length}
                    </p>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mb-4 text-xs text-slate-500">
                  {fmtDate(c.startDate)} → {c.endDate ? fmtDate(c.endDate) : "open"}
                </div>

                {/* Team Preview */}
                {c.members.length > 0 && (
                  <div className="flex items-center gap-1 -space-x-2">
                    {c.members.slice(0, 3).map((m) => (
                      <div key={m.id} className="h-6 w-6 rounded-full bg-slate-200" />
                    ))}
                    {c.members.length > 3 && (
                      <span className="ml-1 text-xs font-medium text-slate-500">+{c.members.length - 3}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
