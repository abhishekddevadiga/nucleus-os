import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import QuickForm from "@/components/QuickForm";
import { getWorkload } from "@/lib/workload";
import { CAMPAIGN_TYPES, CAMPAIGN_PRIORITIES, CAMPAIGN_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [businesses, people, load] = await Promise.all([
    db.business.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    getWorkload(),
  ]);

  const { business: preselectedBusiness } = await searchParams;
  const loadLabel = (id: string) => {
    const l = load.find((x) => x.userId === id);
    return l ? `${l.loadHours}h/${l.capacityHours}h this week` : "";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Create Campaign</h1>
        <p className="mt-2 text-slate-500">Set up a new campaign to organize your work</p>
      </header>

      <div className="space-y-6">
        {/* Campaign Basics */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Campaign Basics</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/campaigns"
            submitLabel="Create Campaign"
            redirectTemplate="/campaigns/{id}"
            fields={[
              { name: "name", label: "Campaign Name", required: true, placeholder: "e.g. Q4 Marketing Push" },
              {
                name: "businessId",
                label: "Business",
                type: "select",
                required: true,
                defaultValue: preselectedBusiness,
                options: businesses.map((b) => ({ value: b.id, label: b.name })),
              },
              {
                name: "campaignType",
                label: "Campaign Type",
                type: "select",
                required: true,
                options: CAMPAIGN_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
              },
              {
                name: "ownerId",
                label: "Campaign Owner",
                type: "select",
                required: true,
                options: people.map((p) => ({ value: p.id, label: `${p.name} ${loadLabel(p.id) ? `· ${loadLabel(p.id)}` : ""}` })),
              },
            ]}
          />
        </section>

        {/* Objectives & Goals */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Objectives & Goals</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/campaigns"
            submitLabel="Save Details"
            fields={[
              {
                name: "objective",
                label: "Campaign Objective",
                type: "textarea",
                placeholder: "What is the primary goal of this campaign? What are we trying to achieve?",
                hint: "Be clear and specific about the desired outcome.",
              },
              {
                name: "goals",
                label: "Success Metrics & Goals",
                type: "textarea",
                placeholder: "How will we measure success? What are the KPIs?",
                hint: "List specific, measurable goals for this campaign.",
              },
            ]}
          />
        </section>

        {/* Timeline & Priority */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Timeline & Priority</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/campaigns"
            submitLabel="Save Timeline"
            fields={[
              {
                name: "startDate",
                label: "Start Date",
                type: "date",
                required: true,
                defaultValue: new Date().toISOString().split("T")[0],
              },
              {
                name: "endDate",
                label: "Target End Date",
                type: "date",
              },
              {
                name: "priority",
                label: "Priority",
                type: "select",
                required: true,
                options: CAMPAIGN_PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                required: true,
                options: CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
              },
            ]}
          />
        </section>

        {/* Description */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Campaign Description</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/campaigns"
            submitLabel="Save Description"
            fields={[
              {
                name: "description",
                label: "Campaign Brief & Details",
                type: "textarea",
                placeholder: "Write a comprehensive campaign brief. Include: execution plan, timeline, responsibilities, deliverables, and any other relevant context.",
                hint: "Use this space for detailed planning, research notes, and strategic information.",
              },
            ]}
          />
        </section>

        {/* Additional Info */}
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">Additional Information</h2>
          <QuickForm
            alwaysOpen
            endpoint="/api/campaigns"
            submitLabel="Save Notes"
            fields={[
              {
                name: "notes",
                label: "Internal Notes",
                type: "textarea",
                placeholder: "Any additional notes, constraints, or context for this campaign.",
              },
            ]}
          />
        </section>
      </div>

      <div className="text-sm text-slate-500">
        <p>💡 You can add team members, assets, and dependencies after creating the campaign.</p>
      </div>
    </div>
  );
}
