import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SectionTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BusinessAssetHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; search?: string; sort?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const { category, search, sort = "recent" } = await searchParams;

  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
  });

  if (!business) redirect("/assets");

  // Fetch categories with asset counts for this business
  const categories = await db.assetCategory.findMany({
    where: { archivedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          assets: {
            where: { businessId: business.id, archivedAt: null },
          },
        },
      },
    },
  });

  // Fetch assets for this business with filters
  const assetWhere: any = {
    businessId: business.id,
    archivedAt: null,
  };

  if (category) {
    assetWhere.categoryId = category;
  }

  if (search) {
    assetWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: any =
    sort === "name"
      ? { name: "asc" }
      : sort === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

  const assets = await db.asset.findMany({
    where: assetWhere,
    include: { category: true, addedBy: true, tags: { include: { tag: true } } },
    orderBy,
    take: 100,
  });

  const filteredCategories = categories.filter((c) => c._count.assets > 0);
  const totalAssets = filteredCategories.reduce((sum, c) => sum + c._count.assets, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <header>
        <Link href="/assets" className="text-sm text-slate-600 hover:text-slate-900">
          ← Asset Hub
        </Link>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {business.logoUrl && (
              <img src={business.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {totalAssets} {totalAssets === 1 ? "asset" : "assets"} organized across {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
              </p>
            </div>
          </div>
          <Link
            href={`/businesses/${business.slug}/assets/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            + Add Asset
          </Link>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="space-y-3">
        <form method="GET" className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search assets..."
            defaultValue={search || ""}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A-Z)</option>
          </select>
          <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
            Search
          </button>
        </form>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/businesses/${business.slug}/assets`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !category
                ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Categories
          </Link>
          {filteredCategories.map((c) => (
            <Link
              key={c.id}
              href={`/businesses/${business.slug}/assets?category=${c.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c.id
                  ? "bg-brand-100 text-brand-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.name} ({c._count.assets})
            </Link>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      {assets.length === 0 ? (
        <EmptyState
          title={search ? "No assets found" : "No assets yet"}
          hint={search ? "Try adjusting your search or filters." : "Add your first asset to get started."}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Link
              key={asset.id}
              href={`/businesses/${business.slug}/assets/${asset.id}`}
              className="card group overflow-hidden p-4 hover:shadow-md transition-shadow"
            >
              {/* Asset Preview */}
              {asset.kind === "file" && asset.mimeType?.startsWith("image/") ? (
                <div className="relative mb-3 h-32 w-full overflow-hidden rounded-lg bg-slate-100">
                  <img
                    src={asset.filePath ? `/api/assets/${asset.id}/file` : ""}
                    alt={asset.name}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    {asset.kind === "link" ? (
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    ) : (
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    )}
                  </svg>
                </div>
              )}

              {/* Asset Info */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-slate-900 truncate flex-1 group-hover:text-brand-600">
                    {asset.name}
                  </h3>
                  {asset.isPinned && (
                    <span className="text-amber-500" title="Pinned">
                      📌
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-2">{asset.category?.name}</p>

                {asset.description && (
                  <p className="text-xs text-slate-600 mb-2 line-clamp-2">{asset.description}</p>
                )}

                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {asset.tags.slice(0, 2).map((at) => (
                      <span
                        key={at.id}
                        className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {at.tag.name}
                      </span>
                    ))}
                    {asset.tags.length > 2 && (
                      <span className="text-xs text-slate-500">+{asset.tags.length - 2}</span>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-400">Added by {asset.addedBy?.name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
