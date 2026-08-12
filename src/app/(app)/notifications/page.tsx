import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import MarkAllRead from "./MarkAllRead";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = {
  reminder: "⏰",
  overdue: "🔴",
  escalation: "🚨",
  assignment: "📌",
  extension: "🕓",
  digest: "📋",
  invoice: "$",
  deal: "🤝",
  deadline: "📅",
};

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: user.id, channel: "in_app" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-slate-500">Escalations can never be muted — they always land here.</p>
        </div>
        <MarkAllRead />
      </header>
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet." hint="Deadline reminders, escalations and assignments arrive here." />
      ) : (
        <div className="card">
          {notifications.map((n) => {
            const inner = (
              <div className={`flex gap-3 border-b border-slate-50 px-4 py-3 last:border-0 ${n.readAt ? "opacity-60" : ""}`}>
                <span className="text-lg">{TYPE_ICON[n.type] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-slate-50">{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
