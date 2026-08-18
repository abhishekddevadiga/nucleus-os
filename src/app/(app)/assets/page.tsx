import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleBusinessIds } from "@/lib/permissions";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssetsHubPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const visibleIds = await getVisibleBusinessIds(user);
  const businesses = await db.business.findMany({
    where: visibleIds === "all" ? {} : { id: { in: visibleIds } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      tagline: true,
      status: true,
      _count: {
        select: { assets: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Asset Hub</h1>
        <p className="mt-2 text-slate-500">Explore and manage assets for your businesses. Each business has its own dedicated, organized asset repository.</p>
      </header>

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          hint="Create a business first to start building its asset library."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/businesses/${b.slug}/assets`}
              className="card group relative overflow-hidden p-6 transition-all hover:shadow-lift"
            >
              <div className="flex items-start gap-4">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-2xl font-bold text-slate-400">
                    {b.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 truncate">{b.name}</h2>
                  {b.tagline && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{b.tagline}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {b._count.assets} {b._count.assets === 1 ? "asset" : "assets"}
                    </span>
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                      b.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : b.status === "planned"
                          ? "bg-blue-100 text-blue-700"
                          : b.status === "paused"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                    }`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-brand-50 transition-all group-hover:scale-150" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
