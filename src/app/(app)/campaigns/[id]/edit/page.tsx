import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/permissions";
import QuickForm from "@/components/QuickForm";
import { CAMPAIGN_TYPES, CAMPAIGN_PRIORITIES, CAMPAIGN_STATUSES } from "@/lib/constants";
import { getWorkload } from "@/lib/workload";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  if (!(await canManageProject(user, id))) notFound();

  const [campaign, businesses, people] = await Promise.all([
    db.campaign.findUnique({
      where: { id },
      include: { business: true, owner: true },
    }),
    db.business.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
  ]);

  if (!campaign) notFound();

  const load = await getWorkload();
  const loadLabel = (userId: string) => {
    const l = load.find((x) => x.userId === userId);
    return l ? `${l.loadHours}h/${l.capacityHours}h this week` : "";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <Link href={`/campaigns/${campaign.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to Campaign
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Edit Campaign</h1>
        <p className="mt-2 text-slate-500">Update campaign details and metadata</p>
      </header>

      <div className="space-y-6">
        {/* Campaign Basics */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Campaign Basics</h2>
          <QuickForm
            alwaysOpen
            endpoint={`/api/campaigns/${campaign.id}`}
            method="PATCH"
            submitLabel="Save Changes"
            redirectTemplate={`/campaigns/${campaign.id}`}
            fields={[
              {
                name: "name",
                label: "Campaign Name",
                required: true,
                defaultValue: campaign.name,
              },
              {
                name: "businessId",
                label: "Business",
                type: "select",
                required: true,
                defaultValue: campaign.businessId,
                options: businesses.map((b) => ({ value: b.id, label: b.name })),
              },
              {
                name: "campaignType",
                label: "Campaign Type",
                type: "select",
                required: true,
                defaultValue: campaign.campaignType,
                options: CAMPAIGN_TYPES.map((t) => ({
                  value: t,
                  label: t.charAt(0).toUpperCase() + t.slice(1),
                })),
              },
              {
                name: "ownerId",
                label: "Campaign Owner",
                type: "select",
                required: true,
                defaultValue: campaign.ownerId,
                options: people.map((p) => ({
                  value: p.id,
                  label: `${p.name} ${loadLabel(p.id) ? `· ${loadLabel(p.id)}` : ""}`,
                })),
              },
            ]}
          />
        </section>

        {/* Objectives & Goals */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Objectives & Goals</h2>
          <QuickForm
            alwaysOpen
            endpoint={`/api/campaigns/${campaign.id}`}
            method="PATCH"
            submitLabel="Save Details"
            fields={[
              {
                name: "objective",
                label: "Campaign Objective",
                type: "textarea",
                placeholder: "What is the primary goal of this campaign?",
                defaultValue: campaign.objective || "",
              },
              {
                name: "goals",
                label: "Success Metrics & Goals",
                type: "textarea",
                placeholder: "How will we measure success?",
                defaultValue: campaign.goals || "",
              },
            ]}
          />
        </section>

        {/* Timeline & Priority */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Timeline & Priority</h2>
          <QuickForm
            alwaysOpen
            endpoint={`/api/campaigns/${campaign.id}`}
            method="PATCH"
            submitLabel="Save Timeline"
            fields={[
              {
                name: "startDate",
                label: "Start Date",
                type: "date",
                required: true,
                defaultValue: campaign.startDate.toISOString().split("T")[0],
              },
              {
                name: "endDate",
                label: "Target End Date",
                type: "date",
                defaultValue: campaign.endDate ? campaign.endDate.toISOString().split("T")[0] : "",
              },
              {
                name: "priority",
                label: "Priority",
                type: "select",
                required: true,
                defaultValue: campaign.priority,
                options: CAMPAIGN_PRIORITIES.map((p) => ({
                  value: p,
                  label: p.charAt(0).toUpperCase() + p.slice(1),
                })),
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                required: true,
                defaultValue: campaign.status,
                options: CAMPAIGN_STATUSES.map((s) => ({
                  value: s,
                  label: s.charAt(0).toUpperCase() + s.slice(1),
                })),
              },
            ]}
          />
        </section>

        {/* Description */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Campaign Description</h2>
          <QuickForm
            alwaysOpen
            endpoint={`/api/campaigns/${campaign.id}`}
            method="PATCH"
            submitLabel="Save Description"
            fields={[
              {
                name: "description",
                label: "Campaign Brief & Details",
                type: "textarea",
                placeholder: "Write a comprehensive campaign brief...",
                defaultValue: campaign.description || "",
              },
            ]}
          />
        </section>

        {/* Additional Info */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Additional Information</h2>
          <QuickForm
            alwaysOpen
            endpoint={`/api/campaigns/${campaign.id}`}
            method="PATCH"
            submitLabel="Save Notes"
            fields={[
              {
                name: "notes",
                label: "Internal Notes",
                type: "textarea",
                placeholder: "Any additional notes or context...",
                defaultValue: campaign.notes || "",
              },
            ]}
          />
        </section>

        {/* Danger Zone */}
        <section className="card border-rose-200 p-6">
          <h2 className="mb-4 text-lg font-semibold text-rose-700">Danger Zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Archiving a campaign will hide it from all views. This action cannot be undone.
          </p>
          <form
            action={async () => {
              "use server";
              await db.campaign.update({
                where: { id },
                data: { archivedAt: new Date() },
              });
              redirect("/campaigns");
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              Archive Campaign
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
