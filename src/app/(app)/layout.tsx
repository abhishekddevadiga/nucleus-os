import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar, { type NavItem } from "@/components/Sidebar";
import { pendingApprovalCount } from "@/lib/approvalsData";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const unread = await db.notification.count({ where: { userId: user.id, readAt: null, channel: "in_app" } });

  const items: NavItem[] = [];
  if (user.isCeo || user.isLead || user.isFinance) items.push({ href: "/", label: "Command Center", icon: "◎" });
  items.push({ href: "/my-work", label: "My Work", icon: "☑" });
  items.push({ href: "/board", label: "Kanban", icon: "▧" });
  items.push({ href: "/projects", label: "Projects", icon: "▤" });
  items.push({ href: "/clients", label: "Businesses", icon: "▦" });
  items.push({ href: "/team", label: "Team", icon: "◈" });
  if (user.isCeo || user.isLead) {
    const pending = pendingApprovalCount();
    items.push({ href: "/approvals", label: pending > 0 ? `Approvals (${pending})` : "Approvals", icon: "✓" });
  }
  if (user.isCeo || user.isLead) items.push({ href: "/workload", label: "Workload", icon: "▥" });
  if (user.isCeo || user.isFinance) items.push({ href: "/invoices", label: "Money", icon: "$" });
  if (user.isCeo || user.isLead || user.isFinance) items.push({ href: "/reports", label: "Reports", icon: "≡" });
  if (user.isCeo || user.isLead) items.push({ href: "/people", label: "People", icon: "◉" });
  if (user.isCeo) items.push({ href: "/activity", label: "Activity Log", icon: "⧗" });
  if (user.isCeo) items.push({ href: "/admin", label: "Admin", icon: "⚙" });
  items.push({ href: "/notifications", label: unread > 0 ? `Inbox (${unread})` : "Inbox", icon: "◨" });

  return (
    <div className="min-h-screen md:ml-60">
      <Sidebar items={items} user={{ name: user.name, title: user.title, avatarColor: user.avatarColor }} />
      <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-10 md:py-12">
        <div key={/* remount per route for the entrance transition */ null} className="animate-page">
          {children}
        </div>
      </main>
    </div>
  );
}
