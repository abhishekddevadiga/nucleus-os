import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleProjectIds, taskProjectWhere } from "@/lib/permissions";
import { computeBucket, BUCKET_COLUMNS, DUE_WINDOW_HOURS } from "@/lib/buckets";
import BucketBoard, { type BucketCard } from "@/components/BucketBoard";
import { relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

// Global kanban: one board across every business, toggled by department
// (vertical) on top, with derived status columns — Backlog / Pending / Due /
// Completed / Client approved.
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { dept } = await searchParams;

  const visible = await getVisibleProjectIds(user);
  const now = new Date();
  const completedCutoff = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

  const tasks = await db.task.findMany({
    where: {
      ...taskProjectWhere(visible),
      archivedAt: null,
      OR: [{ completedAt: null }, { completedAt: { gte: completedCutoff } }],
    },
    include: {
      assignee: true,
      stage: true,
      project: { include: { client: true } },
      vertical: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Department chips: every vertical that has work in scope.
  const departments = [...new Map(tasks.map((t) => [t.vertical.id, t.vertical])).values()].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const active = departments.find((d) => d.slug === dept) ?? null;
  const shown = active ? tasks.filter((t) => t.verticalId === active.id) : tasks;

  const cards: BucketCard[] = shown.map((t) => {
    const stages = t.vertical.stages;
    const first = stages[0];
    const second = stages.length > 1 ? stages[1] : stages[0];
    const terminal = stages[stages.length - 1];
    const due = relativeDue(t.dueDate);
    return {
      id: t.id,
      title: t.title,
      bucket: computeBucket({
        completedAt: t.completedAt,
        dueDate: t.dueDate,
        stageId: t.stageId,
        firstStageId: first?.id,
        terminalStageName: terminal?.name,
        now,
      }),
      priority: t.priority,
      estimateHours: t.estimateHours,
      dueLabel: t.completedAt ? "done" : due.label,
      overdue: !t.completedAt && due.tone === "overdue",
      isTicket: t.isTicket,
      isVariation: !!t.masterTaskId,
      clientName: t.project.client.name,
      verticalName: t.vertical.name,
      stageName: t.stage.name,
      assignee: { name: t.assignee.name, avatarColor: t.assignee.avatarColor },
      targets: { backlog: first?.id, progress: second?.id, done: terminal?.id },
    };
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Kanban</h1>
        <p className="text-sm text-slate-500">
          Every business, one board. Backlog = not started · Pending = in the pipeline · Due = overdue or due within{" "}
          {DUE_WINDOW_HOURS}h · drag a card to move it.
        </p>
      </header>

      {/* Department toggle */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-sm font-semibold text-slate-600">Departments</span>
        <Link
          href="/board"
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            !active
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-canvas-raised text-slate-600 hover:border-slate-300"
          }`}
        >
          All
        </Link>
        {departments.map((d) => (
          <Link
            key={d.id}
            href={`/board?dept=${d.slug}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active?.id === d.id
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-canvas-raised text-slate-600 hover:border-slate-300"
            }`}
          >
            {d.name}
          </Link>
        ))}
      </div>

      <BucketBoard columns={BUCKET_COLUMNS} cards={cards} />
    </div>
  );
}
