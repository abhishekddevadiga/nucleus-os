import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleBusinessIds } from "@/lib/permissions";
import { Avatar, DueBadge, PriorityBadge, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    business?: string;
    campaign?: string;
    assignee?: string;
    priority?: string;
    status?: string;
    search?: string;
    sort?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const {
    business,
    campaign,
    assignee,
    priority,
    status,
    search,
    sort = "due-date",
  } = params;

  const visibleIds = await getVisibleBusinessIds(user);

  // Build where clause
  const where: any = {
    archivedAt: null,
  };

  if (visibleIds !== "all") {
    where.campaign = { businessId: { in: visibleIds } };
  }

  if (business) where.campaign.businessId = business;
  if (campaign) where.campaignId = campaign;
  if (assignee) where.assigneeId = assignee;
  if (priority) where.priority = priority;
  if (status === "completed") where.completedAt = { not: null };
  else if (status === "open") where.completedAt = null;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: any =
    sort === "priority" ? { priority: "asc" } : { dueDate: "asc" };

  const [
    tasks,
    businesses,
    campaigns,
    users,
  ] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        campaign: { include: { business: true } },
        assignee: true,
        workstream: true,
      },
      orderBy,
      take: 200,
    }),
    db.business.findMany({
      where: visibleIds === "all" ? {} : { id: { in: visibleIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.campaign.findMany({
      where:
        visibleIds === "all"
          ? {}
          : { businessId: { in: visibleIds }, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const openTasks = tasks.filter((t) => !t.completedAt);
  const completedTasks = tasks.filter((t) => t.completedAt);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse and manage all tasks across your businesses and campaigns.
        </p>
      </header>

      {/* Search & Filters */}
      <form method="GET" className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search tasks..."
            defaultValue={search || ""}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm"
          />
          <button className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700">
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            name="business"
            defaultValue={business || ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            name="campaign"
            defaultValue={campaign || ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            name="assignee"
            defaultValue={assignee || ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            name="priority"
            defaultValue={priority || ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            name="status"
            defaultValue={status || ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
          </select>

          <select
            name="sort"
            defaultValue={sort}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="due-date">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </form>

      {/* Task List */}
      {openTasks.length === 0 && completedTasks.length === 0 ? (
        <EmptyState title="No tasks found" hint="Adjust your filters or create a new task." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Business / Campaign
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Assignee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {openTasks.map((task) => (
                <tr
                  key={task.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {task.campaign.business.name} / {task.campaign.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={task.assignee.name}
                        color={task.assignee.avatarColor}
                        size={6}
                      />
                      <span className="text-sm text-slate-600">
                        {task.assignee.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <DueBadge due={task.dueDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {completedTasks.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer font-medium text-slate-900">
            Completed ({completedTasks.length})
          </summary>
          <div className="mt-4 space-y-2">
            {completedTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block text-sm text-slate-600 line-through hover:text-slate-900"
              >
                {task.title}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
