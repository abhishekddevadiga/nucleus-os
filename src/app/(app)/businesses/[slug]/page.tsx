import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business",
};

export default async function BusinessDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const business = await db.business.findUnique({
    where: { slug },
    include: {
      campaigns: {
        where: { archivedAt: null },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { tasks: true } },
        },
      },
      assets: {
        where: { archivedAt: null },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, kind: true, category: { select: { name: true } } },
      },
      _count: {
        select: { campaigns: true, assets: true, accessGrants: true },
      },
    },
  });

  if (!business) {
    redirect("/businesses");
  }

  const statusColor = {
    planned: "bg-slate-100 text-slate-700",
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
    sunset: "bg-rose-100 text-rose-700",
  }[business.status as string] || "bg-slate-100 text-slate-700";

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-10 md:py-12">
      <div className="animate-page">
        <Link href="/businesses" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back
        </Link>
        <div className="mt-6 mb-8">
          <div className="flex items-start gap-4">
            {business.logoUrl ? (
              <img src={business.logoUrl} alt={business.name} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-2xl font-semibold text-slate-400">
                {business.name[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-slate-900">{business.name}</h1>
              {business.tagline && <p className="mt-1 text-sm text-slate-600">{business.tagline}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
                  {business.status}
                </span>
                {business.industry && <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{business.industry}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Link href={`/businesses/${business.slug}/campaigns`} className="card p-4 hover:bg-slate-50 transition-colors">
            <p className="text-xs font-medium text-slate-600">Campaigns</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.campaigns}</p>
          </Link>
          <Link href={`/businesses/${business.slug}/assets`} className="card p-4 hover:bg-slate-50 transition-colors">
            <p className="text-xs font-medium text-slate-600">Assets</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.assets}</p>
          </Link>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-600">Access Grants</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.accessGrants}</p>
          </div>
        </div>

        {business.description && (
          <div className="card mb-8 p-6">
            <h3 className="text-sm font-semibold text-slate-900">About</h3>
            <p className="mt-3 text-sm text-slate-700">{business.description}</p>
          </div>
        )}

        {business.campaigns.length > 0 && (
          <div className="card mb-8 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Campaigns</h3>
            <div className="space-y-2">
              {business.campaigns.map((p) => (
                <Link key={p.id} href={`/campaigns/${p.id}`} className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p._count.tasks} tasks</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {p.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {business.assets.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Asset Hub</h3>
              <Link href={`/businesses/${business.slug}/assets`} className="text-xs text-brand-600 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {business.assets.map((a) => (
                <Link key={a.id} href={`/businesses/${business.slug}/assets/${a.id}`} className="group rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50 transition-all">
                  <p className="text-xs font-medium text-slate-900 group-hover:text-brand-600 truncate">{a.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{a.category?.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
