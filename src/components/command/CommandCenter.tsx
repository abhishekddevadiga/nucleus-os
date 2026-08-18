"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState, SectionTitle } from "@/components/ui";

type TaskData = {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: string;
  completedAt: Date | null;
  campaign: { name: string; businessId: string };
  assignee: { name: string; id: string };
  workstream: { name: string } | null;
};

type ActivityData = {
  id: string;
  action: string;
  entityType: string;
  toValue: string | null;
  createdAt: Date;
  actorName: string | null;
};

type BusinessData = {
  id: string;
  name: string;
  createdAt: Date;
};

interface CommandCenterProps {
  myTasks?: TaskData[];
  activities?: ActivityData[];
  businesses?: BusinessData[];
}

export default function CommandCenter({ myTasks = [], activities = [], businesses = [] }: CommandCenterProps) {
  const [selectedFilter, setSelectedFilter] = useState<"all" | "overdue" | "today">("all");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const openTasks = myTasks.filter((t) => !t.completedAt);
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const todayTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow);
  const upcomingTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) >= tomorrow);

  let filteredTasks = openTasks;
  if (selectedFilter === "overdue") filteredTasks = overdueTasks;
  if (selectedFilter === "today") filteredTasks = todayTasks;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Here's what needs your attention today.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{overdueTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Overdue tasks</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{todayTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Due today</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{upcomingTasks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Upcoming (7 days)</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-slate-900">{businesses.length}</p>
          <p className="text-xs text-slate-500 mt-1">Active businesses</p>
        </div>
      </div>

      {/* My Tasks Section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>My Tasks & Priorities</SectionTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter("all")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedFilter === "all" ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({openTasks.length})
            </button>
            <button
              onClick={() => setSelectedFilter("overdue")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedFilter === "overdue" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Overdue ({overdueTasks.length})
            </button>
            <button
              onClick={() => setSelectedFilter("today")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedFilter === "today" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Today ({todayTasks.length})
            </button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <EmptyState title={selectedFilter === "all" ? "No tasks assigned." : `No ${selectedFilter} tasks.`} />
        ) : (
          <div className="card divide-y divide-slate-100">
            {filteredTasks.slice(0, 10).map((task) => {
              const dueDate = task.dueDate ? new Date(task.dueDate) : null;
              const isPastDue = dueDate && dueDate < today;
              const isDueToday = dueDate && dueDate >= today && dueDate < tomorrow;

              return (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{task.title}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{task.campaign.name}</span>
                        {task.workstream && <span>· {task.workstream.name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {dueDate && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            isPastDue
                              ? "bg-rose-100 text-rose-700"
                              : isDueToday
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          task.priority === "high"
                            ? "bg-rose-100 text-rose-700"
                            : task.priority === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Businesses */}
      {businesses.length > 0 && (
        <section>
          <SectionTitle>Recently Added Businesses</SectionTitle>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {businesses.slice(0, 6).map((biz) => (
              <Link key={biz.id} href={`/businesses/${biz.name.toLowerCase().replace(/\s+/g, "-")}`} className="card p-4 hover:bg-slate-50 transition-colors">
                <p className="font-medium text-slate-900">{biz.name}</p>
                <p className="text-xs text-slate-500 mt-2">Added {biz.createdAt.toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <section>
          <SectionTitle>Recent Activity</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="p-4">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{activity.actorName || "System"}</span> {activity.action} {activity.entityType}
                  {activity.toValue && <span className="text-slate-500"> ({activity.toValue})</span>}
                </p>
                <p className="text-xs text-slate-500 mt-1">{activity.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
