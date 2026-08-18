import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleBusinessIds } from "@/lib/permissions";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Businesses",
};

export default async function BusinessesPage() {
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
      tagline: true,
      status: true,
      logoUrl: true,
      _count: {
        select: { campaigns: true, assets: true },
      },
    },
  });

  return (
    <>
      <div className="mb-8 animate-page">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold text-slate-900">Businesses</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your independent business units, brands, and products.</p>
        </div>
        {user.isOwner || user.isLead ? (
          <Link
            href="/businesses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            + New business
          </Link>
        ) : null}
      </div>

      {businesses.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-slate-600">No businesses yet.</p>
          <p className="mt-1 text-xs text-slate-500">Create your first business to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/businesses/${b.slug}`}
              className="card group relative overflow-hidden transition-all hover:shadow-lift"
            >
              <div className="flex items-start gap-3">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-lg font-semibold text-slate-400">
                    {b.name[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-600">{b.name}</h3>
                  {b.tagline && <p className="mt-0.5 truncate text-xs text-slate-500">{b.tagline}</p>}
                  <div className="mt-2 flex gap-2">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {b._count.campaigns} {b._count.campaigns === 1 ? "campaign" : "campaigns"}
                    </span>
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {b._count.assets} {b._count.assets === 1 ? "asset" : "assets"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-brand-50 transition-all group-hover:scale-150" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
