import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Avatar, SectionTitle } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getDashboardData(user);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-slate-500">Here's what needs your attention</p>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-rose-600">{data.overdueTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Overdue tasks</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-amber-600">{data.dueTodayTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Due today</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">{data.dueThisWeekTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Due this week</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-emerald-600">{data.activeCampaigns.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active campaigns</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Tasks */}
          {data.myTasks.length > 0 && (
            <section className="card p-6">
              <SectionTitle>My Tasks</SectionTitle>
              <div className="space-y-2">
                {data.myTasks.slice(0, 8).map((task) => {
                  const due = new Date(task.dueDate);
                  const isOverdue = due < now;
                  const isPastDue = isOverdue ? Math.ceil((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)) : 0;

                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{task.title}</p>
                        <p className="text-xs text-slate-500">
                          {task.campaign.name} · {task.workstream.name}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ml-2 ${
                          isOverdue
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isOverdue ? `${isPastDue}d overdue` : fmtDate(task.dueDate)}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {data.myTasks.length > 8 && (
                <Link href="/tasks" className="mt-3 text-sm text-brand-600 hover:underline block">
                  View all {data.myTasks.length} tasks →
                </Link>
              )}
            </section>
          )}

          {/* Upcoming Milestones */}
          {data.upcomingMilestones.length > 0 && (
            <section className="card p-6">
              <SectionTitle>Upcoming Milestones</SectionTitle>
              <div className="space-y-2">
                {data.upcomingMilestones.map((milestone) => (
                  <Link
                    key={milestone.id}
                    href={`/campaigns/${milestone.campaignId}`}
                    className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{milestone.title}</p>
                      <p className="text-xs text-slate-500">{milestone.campaign.name}</p>
                    </div>
                    <span className="text-xs text-slate-600">{fmtDate(milestone.dueDate)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent Activity */}
          {data.recentActivity.length > 0 && (
            <section className="card p-6">
              <SectionTitle>Recent Activity</SectionTitle>
              <div className="space-y-2">
                {data.recentActivity.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="text-sm text-slate-700 border-b border-slate-100 pb-2 last:border-0">
                    <p>
                      <strong className="text-slate-900">{activity.actorName}</strong>{" "}
                      <span className="text-slate-600">{activity.action}</span>{" "}
                      <span className="text-slate-500 text-xs">
                        {activity.createdAt.toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Active Campaigns */}
          {data.activeCampaigns.length > 0 && (
            <section className="card p-4">
              <SectionTitle>Active Campaigns</SectionTitle>
              <div className="space-y-2">
                {data.activeCampaigns.slice(0, 5).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="block text-sm text-brand-600 hover:underline truncate"
                  >
                    {campaign.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Businesses */}
          {data.businesses.length > 0 && (
            <section className="card p-4">
              <SectionTitle>Businesses</SectionTitle>
              <div className="space-y-2">
                {data.businesses.slice(0, 6).map((business) => (
                  <Link
                    key={business.id}
                    href={`/businesses/${business.slug}`}
                    className="flex items-center gap-2 rounded p-2 hover:bg-slate-50 text-sm"
                  >
                    {business.logoUrl ? (
                      <img src={business.logoUrl} alt="" className="h-6 w-6 rounded" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {business.name[0]}
                      </div>
                    )}
                    <span className="truncate text-slate-900">{business.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Team */}
          {data.teamMembers.length > 0 && (
            <section className="card p-4">
              <SectionTitle>Team</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {data.teamMembers.slice(0, 6).map((member) => (
                  <Avatar
                    key={member.id}
                    name={member.name}
                    color={member.avatarColor}
                    size={6}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
