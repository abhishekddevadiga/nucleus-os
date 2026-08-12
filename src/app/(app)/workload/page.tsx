import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getWorkload } from "@/lib/workload";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";

// Workload & capacity: per person per week, estimates vs capacity.
// Green <85%, amber 85–100%, red >100%. Cross-business by design.
export default async function WorkloadPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isLead) redirect("/my-work");

  const load = await getWorkload();
  const bandCls = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500" } as const;
  const bandChip = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700",
  } as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Workload — this week</h1>
        <p className="text-sm text-slate-500">
          Sum of estimates on open tasks + tickets due this week (overdue included) vs weekly capacity.
          One view across every brand and product — nobody gets silently double-booked.
        </p>
      </header>
      <div className="card">
        {load.map((p) => (
          <Link key={p.userId} href={`/people/${p.userId}`} className="flex items-center gap-4 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50">
            <Avatar name={p.name} color={p.avatarColor} size={9} />
            <div className="w-44 min-w-0">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-xs text-slate-400">{p.title}</p>
            </div>
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${bandCls[p.band]}`}
                  style={{ width: `${Math.min(100, Math.round(p.ratio * 100))}%` }}
                />
              </div>
            </div>
            <div className="w-40 text-right">
              <span className={`chip ${bandChip[p.band]}`}>
                {p.loadHours}h / {p.capacityHours}h · {Math.round(p.ratio * 100)}%
              </span>
            </div>
            <div className="hidden w-36 text-right text-xs text-slate-400 sm:block">
              {p.openTasks} open{p.overdueTasks > 0 && <span className="font-semibold text-rose-600"> · {p.overdueTasks} overdue</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
