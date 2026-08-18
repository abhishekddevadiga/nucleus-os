import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import QuickForm from "@/components/QuickForm";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "sunset", label: "Sunset" },
];

export default async function NewBusinessPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isOwner) redirect("/businesses");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Create Business</h1>
        <p className="mt-2 text-slate-500">Set up a new independent business with its own campaigns, assets, and team structure.</p>
      </header>

      <div className="space-y-6">
        {/* Basic Info */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Business Basics</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/businesses"
            submitLabel="Create Business"
            redirectTemplate="/businesses/{slug}"
            fields={[
              {
                name: "name",
                label: "Business Name",
                required: true,
                placeholder: "e.g., Acme Corp, Tech Startup, Design Studio",
                hint: "The official name of this business",
              },
              {
                name: "tagline",
                label: "Tagline",
                placeholder: "Short description of what this business does",
                hint: "One-line summary for quick reference",
              },
              {
                name: "industry",
                label: "Industry",
                placeholder: "e.g., Technology, Design, Marketing, E-commerce",
                hint: "The industry or sector this business operates in",
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                defaultValue: "planned",
                options: STATUS_OPTIONS,
              },
            ]}
          />
        </section>

        {/* Description & Details */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">About</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/businesses"
            submitLabel="Save Details"
            fields={[
              {
                name: "description",
                label: "Business Description",
                type: "textarea",
                placeholder: "What is this business? What does it do? What makes it unique?",
                hint: "A brief overview of the business and its mission",
              },
              {
                name: "website",
                label: "Website URL",
                placeholder: "https://example.com",
                hint: "The official website (optional)",
              },
              {
                name: "contactEmail",
                label: "Contact Email",
                type: "email",
                placeholder: "hello@example.com",
                hint: "Primary contact email for this business",
              },
              {
                name: "contactPhone",
                label: "Contact Phone",
                placeholder: "+1 (555) 123-4567",
                hint: "Primary phone number (optional)",
              },
            ]}
          />
        </section>

        <section className="text-sm text-slate-500">
          <p>💡 After creating the business, you'll be able to:</p>
          <ul className="mt-2 space-y-1 ml-4">
            <li>• Add a logo and brand colors</li>
            <li>• Create campaigns specific to this business</li>
            <li>• Build a dedicated Asset Hub for this business</li>
            <li>• Assign team members to work on this business</li>
            <li>• Configure workstreams and task pipelines</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
