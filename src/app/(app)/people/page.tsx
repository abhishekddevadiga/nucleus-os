import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkload } from "@/lib/workload";
import { Avatar } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isLead) redirect("/my-work");

  const [people, load] = await Promise.all([
    db.user.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      include: { roleAssignments: true },
    }),
    getWorkload(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-slate-500">The company-level pool — everyone works across businesses by design.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => {
          const l = load.find((x) => x.userId === p.id);
          const roles = [...new Set(p.roleAssignments.map((r) => ROLE_LABELS[r.role as Role] ?? r.role))];
          return (
            <Link key={p.id} href={`/people/${p.id}`} className="card block p-4 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} color={p.avatarColor} size={9} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">{p.title ?? roles.join(", ")}</p>
                </div>
                {l && (
                  <span className={`chip ${l.band === "red" ? "bg-rose-100 text-rose-700" : l.band === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                    {l.loadHours}h/{l.capacityHours}h
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {l ? `${l.openTasks} open task(s)` : ""}
                {l && l.overdueTasks > 0 && <span className="font-semibold text-rose-600"> · {l.overdueTasks} overdue</span>}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
