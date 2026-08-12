import Link from "next/link";
import { initials, relativeDue, fmtDate } from "@/lib/format";

// Server-safe presentation primitives shared across every page. Restrained
// by design: neutral tones dominate, colour appears only to signal state.

export function Avatar({ name, color, size = 7 }: { name: string; color: string; size?: 6 | 7 | 9 }) {
  const cls = size === 6 ? "h-6 w-6 text-[10px]" : size === 9 ? "h-9 w-9 text-[13px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      className={`inline-flex ${cls} shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function DueBadge({ due, completed }: { due: Date | string; completed?: boolean }) {
  if (completed) return <span className="chip bg-emerald-100 text-emerald-700">Done</span>;
  const { label, tone } = relativeDue(due);
  const cls =
    tone === "overdue"
      ? "bg-rose-100 text-rose-700"
      : tone === "today"
        ? "bg-amber-100 text-amber-800"
        : tone === "soon"
          ? "bg-sky-100 text-sky-700"
          : "bg-slate-100 text-slate-500";
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    urgent: "bg-rose-500/90 text-white ring-rose-400/20",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-slate-100 text-slate-500",
    low: "bg-slate-50 text-slate-400",
  };
  return <span className={`chip ${cls[priority] ?? cls.medium}`}>{priority}</span>;
}

export function HealthBadge({ health }: { health: "on_track" | "at_risk" | "delayed" }) {
  const map = {
    on_track: ["On track", "bg-emerald-100 text-emerald-700"],
    at_risk: ["At risk", "bg-amber-100 text-amber-800"],
    delayed: ["Delayed", "bg-rose-100 text-rose-700"],
  } as const;
  const [label, cls] = map[health];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`chip ${kind === "internal" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
      {kind}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-500",
    sent: "bg-sky-100 text-sky-700",
    partial: "bg-amber-100 text-amber-800",
    paid: "bg-emerald-100 text-emerald-700",
    overdue: "bg-rose-100 text-rose-700",
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-100 text-slate-500",
    archived: "bg-slate-100 text-slate-400",
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return <span className={`chip ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{status.replace(/_/g, " ")}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-[13px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  href,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "danger" | "warn" | "good";
  href?: string;
  sub?: string;
}) {
  const dot =
    tone === "danger" ? "bg-rose-600" : tone === "warn" ? "bg-amber-600" : tone === "good" ? "bg-emerald-600" : "bg-slate-300";
  const valueCls =
    tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-slate-900" : "text-slate-900";
  const inner = (
    <div className={`${href ? "card-interactive" : "card"} px-5 py-4`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="text-[11px] font-medium tracking-tight text-slate-500">{label}</p>
      </div>
      <p className={`mt-2 text-[28px] font-semibold leading-none tabular-nums tracking-tight ${valueCls}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-800">{children}</h2>
      {action}
    </div>
  );
}

export function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    isTicket: boolean;
    priority: string;
    dueDate: Date;
    completedAt: Date | null;
    stage: { name: string };
    vertical: { name: string };
    project: { id: string; name: string; client: { name: string } };
    assignee: { name: string; avatarColor: string };
    escalationLevel: number;
  };
}) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
    >
      <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={6} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800">
          {task.isTicket && <span className="mr-1.5 rounded bg-fuchsia-100 px-1.5 py-px text-[10px] font-semibold tracking-tight text-fuchsia-700">Ticket</span>}
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">
          {task.project.client.name} · {task.project.name} · {task.vertical.name} → {task.stage.name}
        </p>
      </div>
      {task.escalationLevel >= 3 && <span className="chip bg-rose-500/90 text-white">CEO</span>}
      <PriorityBadge priority={task.priority} />
      <DueBadge due={task.dueDate} completed={!!task.completedAt} />
    </Link>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-[11px] font-medium tracking-tight text-slate-500">{children}</th>;
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[13px] text-slate-700 ${className}`}>{children}</td>;
}

export function fmtRange(start: Date, end: Date | null) {
  return `${fmtDate(start)} → ${end ? fmtDate(end) : "open"}`;
}
