import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import QuickForm from "@/components/QuickForm";
import { getWorkload } from "@/lib/workload";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [clients, templates, verticals, load] = await Promise.all([
    db.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, include: { division: true } }),
    db.projectTemplate.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    db.vertical.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" } }),
    getWorkload(),
  ]);
  const { client: preselectedClient } = await searchParams;
  const loadLabel = (id: string) => {
    const l = load.find((x) => x.userId === id);
    return l ? `${l.loadHours}h/${l.capacityHours}h this week` : "";
  };
  const people = await db.user.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">New project</h1>
        <p className="text-sm text-slate-500">
          Pick a template and the verticals, milestones and task list (with relative deadlines) come pre-attached.
        </p>
      </header>
      <QuickForm
        alwaysOpen
        endpoint="/api/projects"
        submitLabel="Create project"
        redirectTemplate="/projects/{id}"
        fields={[
          { name: "name", label: "Project name", required: true, placeholder: "e.g. Spring Campaign" },
          {
            name: "clientId", label: "Business / client", type: "select", required: true,
            defaultValue: preselectedClient,
            options: clients.map((c) => ({ value: c.id, label: `${c.name} (${c.division.name})` })),
          },
          {
            name: "templateId", label: "Template", type: "select",
            options: templates.map((t) => ({ value: t.id, label: `${t.name} — ${t.description ?? ""}` })),
            hint: "Optional. Without a template, pick verticals manually below.",
          },
          {
            name: "ownerId", label: "Project owner (PM)", type: "select", required: true,
            options: people.map((p) => ({ value: p.id, label: `${p.name} — ${loadLabel(p.id)}` })),
          },
          {
            name: "defaultAssigneeId", label: "Default assignee for templated tasks", type: "select",
            options: people.map((p) => ({ value: p.id, label: `${p.name} — ${loadLabel(p.id)}` })),
            hint: "Templated tasks land here until the PM reassigns. Defaults to the PM.",
          },
          { name: "value", label: "Value", type: "number", min: 0 },
          { name: "startDate", label: "Start date", type: "date" },
          {
            name: "verticalIds", label: "Vertical (manual, when no template)", type: "select",
            options: verticals.map((v) => ({ value: v.id, label: v.name })),
            hint: "More verticals can be attached anytime from the project page.",
          },
          { name: "notes", label: "Scope notes", type: "textarea" },
        ]}
      />
    </div>
  );
}
