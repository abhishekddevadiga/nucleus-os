import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

// Global immutable activity log. Read-only by construction — no
// edit or delete path exists anywhere.
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isOwner) redirect("/my-work");
  const { page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = 100;

  const [rows, total] = await Promise.all([
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * perPage,
      take: perPage,
    }),
    db.activityLog.count(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-slate-500">
          Append-only, immutable, timestamped — {total.toLocaleString()} entries. The spine of the system.
        </p>
      </header>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-100">
            <tr><Th>Timestamp</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Change</Th><Th></Th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <Td className="whitespace-nowrap text-xs">{fmtDateTime(a.createdAt)}</Td>
                <Td>
                  <span className={`chip ${a.actorId ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
                    {a.actorId ? a.actorName : "SYSTEM"}
                  </span>
                </Td>
                <Td className="text-xs font-medium">{a.action.replace(/[._]/g, " ")}</Td>
                <Td className="text-xs">{a.entityType}</Td>
                <Td className="text-xs">
                  {a.fromValue && a.toValue ? `${trim(a.fromValue)} → ${trim(a.toValue)}` : trim(a.toValue ?? "")}
                </Td>
                <Td>
                  {a.taskId && <Link href={`/tasks/${a.taskId}`} className="text-xs text-brand-600 hover:underline">task →</Link>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        {pageNum > 1 ? <Link className="btn-ghost" href={`/activity?page=${pageNum - 1}`}>← Newer</Link> : <span />}
        {pageNum * perPage < total ? <Link className="btn-ghost" href={`/activity?page=${pageNum + 1}`}>Older →</Link> : <span />}
      </div>
    </div>
  );
}

function trim(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return v.length > 48 ? v.slice(0, 45) + "…" : v;
}
