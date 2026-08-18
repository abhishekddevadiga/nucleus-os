import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import QuickForm from "@/components/QuickForm";

export const dynamic = "force-dynamic";

const ASSET_TYPES = [
  {
    value: "brand-assets",
    label: "Brand Assets",
    description: "Logos, logos marks, favicons, icons, brand assets",
  },
  {
    value: "brand-guidelines",
    label: "Brand Guidelines",
    description: "Brand books, style guides, usage rules",
  },
  {
    value: "colors",
    label: "Color Palette",
    description: "Color swatches, hex codes, color specifications",
  },
  {
    value: "typography",
    label: "Typography",
    description: "Font files, font specifications, type scale",
  },
  {
    value: "design-files",
    label: "Design Files",
    description: "Figma, Canva, Adobe XD, Sketch files",
  },
  {
    value: "documents",
    label: "Documents",
    description: "PDFs, Word, Google Docs, presentations",
  },
  {
    value: "marketing",
    label: "Marketing Assets",
    description: "Ads, campaigns, promotional materials",
  },
  {
    value: "social-media",
    label: "Social Media Assets",
    description: "Posts, graphics, video clips",
  },
  {
    value: "website",
    label: "Website Assets",
    description: "Web images, web components, web resources",
  },
  {
    value: "images",
    label: "Images",
    description: "Photos, graphics, illustrations",
  },
  {
    value: "videos",
    label: "Videos",
    description: "Video files, video clips, recordings",
  },
  {
    value: "content",
    label: "Content Resources",
    description: "Blog posts, articles, copy, content",
  },
  {
    value: "development",
    label: "Development Resources",
    description: "APIs, documentation, code, GitHub links",
  },
  {
    value: "external-links",
    label: "External Links",
    description: "Useful resources, tools, references",
  },
  {
    value: "drive-folders",
    label: "Drive Folders",
    description: "Google Drive, Dropbox, cloud storage links",
  },
  {
    value: "notes",
    label: "Important Notes",
    description: "Reminders, notes, internal documentation",
  },
  {
    value: "custom",
    label: "Custom Resources",
    description: "Other resources and materials",
  },
];

export default async function NewAssetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;

  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!business) redirect("/assets");

  const categories = await db.assetCategory.findMany({
    where: { archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <Link href={`/businesses/${business.slug}/assets`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to Assets
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Add Asset to {business.name}</h1>
        <p className="mt-2 text-slate-500">Choose the type of asset you want to add and fill in the details.</p>
      </header>

      {/* Asset Type Selector */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">What type of asset are you adding?</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {ASSET_TYPES.map((type) => (
            <a
              key={type.value}
              href={`#type=${type.value}`}
              className="group rounded-lg border border-slate-200 p-4 transition-all hover:border-brand-300 hover:bg-brand-50 cursor-pointer"
            >
              <p className="font-medium text-slate-900 group-hover:text-brand-600">{type.label}</p>
              <p className="text-xs text-slate-500 mt-1">{type.description}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Asset Form */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Asset Details</h2>
        <QuickForm
          alwaysOpen
          endpoint={`/api/businesses/${business.id}/assets`}
          submitLabel="Add Asset"
          redirectTemplate={`/businesses/${business.slug}/assets/{id}`}
          fields={[
            {
              name: "name",
              label: "Asset Name",
              required: true,
              placeholder: "e.g., Logo Mark (Primary)",
              hint: "Give this asset a clear, descriptive name",
            },
            {
              name: "categoryId",
              label: "Category",
              type: "select",
              required: true,
              options: categories.map((c) => ({ value: c.id, label: c.name })),
              hint: "Choose the category that best describes this asset",
            },
            {
              name: "kind",
              label: "Asset Type",
              type: "select",
              required: true,
              options: [
                { value: "file", label: "File Upload" },
                { value: "link", label: "External Link" },
              ],
              hint: "Upload a file or link to an external resource",
            },
            {
              name: "description",
              label: "Description",
              type: "textarea",
              placeholder: "Describe what this asset is, how to use it, any important notes...",
              hint: "Help team members understand what this asset is and when to use it",
            },
          ]}
        />
      </section>

      <section className="text-sm text-slate-500">
        <p>💡 After creating the asset, you can upload files, add versions, link it to campaigns, and manage access.</p>
      </section>
    </div>
  );
}
