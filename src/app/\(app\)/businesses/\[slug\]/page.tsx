import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business",
};

export default async function BusinessDetailPage({ params }: { params: { slug: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const business = await db.business.findUnique({
    where: { slug: params.slug },
    include: {
      projects: {
        where: { archivedAt: null },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { tasks: true } },
        },
      },
      taskLinks: {
        where: { task: { archivedAt: null, completedAt: null } },
        take: 5,
        select: { task: { select: { id: true, title: true, priority: true, dueDate: true } } },
      },
      assets: {
        where: { archivedAt: null },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, kind: true, category: { select: { name: true } } },
      },
      _count: {
        select: { projects: true, tasks: true, assets: true, accessGrants: true },
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
        {/* Header */}
        <div className="mb-8">
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

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-600">Active Projects</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.projects}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-600">Open Tasks</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business.taskLinks.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-600">Assets</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.assets}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-600">Access Grants</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{business._count.accessGrants}</p>
          </div>
        </div>

        {/* Description */}
        {business.description && (
          <div className="card mb-8 p-6">
            <h3 className="text-sm font-semibold text-slate-900">About</h3>
            <p className="mt-3 text-sm text-slate-700">{business.description}</p>
          </div>
        )}

        {/* Contact & Links */}
        {(business.website || business.contactEmail || business.contactPhone) && (
          <div className="card mb-8 p-6">
            <h3 className="text-sm font-semibold text-slate-900">Contact</h3>
            <div className="mt-3 space-y-2">
              {business.website && (
                <p>
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    {business.website}
                  </a>
                </p>
              )}
              {business.contactEmail && <p className="text-sm text-slate-700">{business.contactEmail}</p>}
              {business.contactPhone && <p className="text-sm text-slate-700">{business.contactPhone}</p>}
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {business.projects.length > 0 && (
          <div className="card mb-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Projects</h3>
              <Link href={`/projects?business=${business.id}`} className="text-xs text-brand-600 hover:text-brand-700">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {business.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p._count.tasks} tasks</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    p.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : p.status === "completed"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-50 text-slate-600"
                  }`}>
                    {p.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Assets */}
        {business.assets.length > 0 && (
          <div className="card mb-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Assets</h3>
              <Link href={`/assets?business=${business.id}`} className="text-xs text-brand-600 hover:text-brand-700">
                View all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {business.assets.map((a) => (
                <Link
                  key={a.id}
                  href={`/assets/${a.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 hover:border-brand-400 hover:bg-brand-50"
                >
                  <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                  <div className="flex gap-1">
                    <span className="text-xs text-slate-500">{a.category.name}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-500">{a.kind}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {business.notes && (
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
            <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{business.notes}</p>
          </div>
        )}
      </div>
    </main>
  );
}
