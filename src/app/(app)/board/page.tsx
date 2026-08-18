import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleCampaignIds, taskProjectWhere } from "@/lib/permissions";
import { computeBucket, BUCKET_COLUMNS, DUE_WINDOW_HOURS } from "@/lib/buckets";
import BucketBoard, { type BucketCard } from "@/components/BucketBoard";
import { relativeDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { ws } = await searchParams;

  const visible = await getVisibleCampaignIds(user);
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
      campaign: { include: { business: true } },
      workstream: { include: { stages: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  // Workstream chips: every workstream that has work in scope.
  const workstreams = [...new Map(tasks.map((t) => [t.workstream.id, t.workstream])).values()].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const active = workstreams.find((w) => w.slug === ws) ?? null;
  const shown = active ? tasks.filter((t) => t.workstreamId === active.id) : tasks;

  const cards: BucketCard[] = shown.map((t) => {
    const stages = t.workstream.stages;
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
      clientName: t.campaign.business.name,
      verticalName: t.workstream.name,
      stageName: t.stage.name,
      assignee: { name: t.assignee.name, avatarColor: t.assignee.avatarColor },
      targets: { backlog: first?.id, progress: second?.id, done: terminal?.id },
    };
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Kanban</h1>
        <p className="text-sm text-slate-500">All tasks across all projects, organized by workstream.</p>
      </header>
      {workstreams.length > 0 && (
        <nav className="flex flex-wrap gap-1">
          <Link href="/board" className={`tab ${!active ? "tab-active" : ""}`}>All Workstreams</Link>
          {workstreams.map((w) => (
            <Link key={w.id} href={`/board?ws=${w.slug}`} className={`tab ${active?.id === w.id ? "tab-active" : ""}`}>
              {w.name}
            </Link>
          ))}
        </nav>
      )}
      <BucketBoard columns={BUCKET_COLUMNS} cards={cards} />
    </div>
  );
}
