"use client";

import { useMemo, useRef, useState } from "react";
import {
  CAPACITY_H, ME, NOW, PIPELINE, PRIORITY_RANK, TONE_HEX, CLIENT_COLOR,
  allCampaigns, dayLabel, daysOverdue, deadlineLabel, isOverdue, isToday, nextStage, rungTag,
  seedTasks, stageIndex, stageTone, withinThisWeek, type Priority, type Task,
} from "@/lib/myWorkData";

/* ---------- atoms ---------- */
function Avatar({ photo, name, size = 40 }: { photo: number; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cls = "rounded-full object-cover ring-2 ring-white";
  if (failed) return <div className={`${cls} flex items-center justify-center bg-indigo-500 font-semibold text-white`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>;
  return <img className={cls} style={{ width: size, height: size }} src={`https://i.pravatar.cc/120?img=${photo}`} alt={name} onError={() => setFailed(true)} />;
}
const STAGE_CHIP = { slate: "bg-slate-100 text-slate-500", sky: "bg-sky-100 text-sky-700", amber: "bg-amber-100 text-amber-800", emerald: "bg-emerald-100 text-emerald-700" } as const;
const DEADLINE_TEXT = { rose: "text-rose-600", amber: "text-amber-600", slate: "text-slate-500" } as const;
function PriorityFlag({ p }: { p: Priority }) {
  if (p === "low") return null;
  const c = p === "urgent" ? "#f43f5e" : p === "high" ? "#fb923c" : "#8a8a95";
  return <svg width="12" height="12" viewBox="0 0 24 24" fill={c} aria-label={`${p} priority`}><path d="M5 3v18M5 4h11l-2 3 2 3H5" stroke={c} strokeWidth="1.6" fill={p === "medium" ? "none" : c} strokeLinejoin="round" /></svg>;
}
function TicketIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-fuchsia-700" aria-label="Ticket"><path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" /></svg>;
}

/* ================================================================= */
export default function MyWork() {
  const [tasks, setTasks] = useState<Task[]>(() => seedTasks());
  const [project, setProject] = useState("all");
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const refs = { overdue: useRef<HTMLDivElement>(null), today: useRef<HTMLDivElement>(null), week: useRef<HTMLDivElement>(null), backlog: useRef<HTMLDivElement>(null) };
  function toast(msg: string) { const id = Math.floor(NOW.getTime() % 1e6) + toasts.length + Math.floor(performance.now()); setToasts((t) => [...t, { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600); }
  function goto(key: keyof typeof refs) { refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" }); setFlash(key); setTimeout(() => setFlash(null), 1300); }

  const scoped = useMemo(() => tasks.filter((t) => t.status !== "done" && (project === "all" || t.campaign === project)), [tasks, project]);

  const overdue = useMemo(() => scoped.filter(isOverdue).sort((a, b) => daysOverdue(b.due) - daysOverdue(a.due)), [scoped]);
  const today = useMemo(() => scoped.filter((t) => !isOverdue(t) && (isToday(t.due) || t.status === "in_progress"))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.due.localeCompare(b.due)), [scoped]);
  const todayIds = new Set(today.map((t) => t.id));
  const weekTasks = useMemo(() => scoped.filter((t) => !isOverdue(t) && !todayIds.has(t.id) && withinThisWeek(t.due)).sort((a, b) => a.due.localeCompare(b.due)), [scoped]);
  const weekDays = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of weekTasks) { const k = t.due; if (!map.has(k)) map.set(k, []); map.get(k)!.push(t); }
    return Array.from(map.entries()).map(([due, list]) => ({ due, list, hours: list.reduce((s, t) => s + t.est, 0) }));
  }, [weekTasks]);
  const backlog = useMemo(() => scoped.filter((t) => !isOverdue(t) && !todayIds.has(t.id) && daysOverdue(t.due) < -7).sort((a, b) => a.due.localeCompare(b.due)), [scoped]);

  const inProgress = scoped.filter((t) => t.status === "in_progress").length;
  const dueTodayCount = scoped.filter((t) => !isOverdue(t) && isToday(t.due)).length;
  const weekLoad = scoped.filter((t) => isOverdue(t) || isToday(t.due) || withinThisWeek(t.due)).reduce((s, t) => s + t.est, 0);
  const loadPct = Math.round((weekLoad / CAPACITY_H) * 100);
  const loadTone = loadPct > 100 ? "rose" : loadPct >= 85 ? "amber" : "emerald";

  const hour = NOW.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = NOW.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  /* ---------- mutations ---------- */
  function move(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const nx = nextStage(t.vertical, t.stage);
    setTasks((prev) => prev.map((x) => x.id === id ? (nx ? { ...x, stage: nx, status: "in_progress" } : { ...x, status: "done" }) : x));
    toast(nx ? `Moved “${t.title}” → ${nx}` : `Completed “${t.title}” 🎉`);
  }
  const current = openTask ? tasks.find((t) => t.id === openTask) ?? null : null;

  /* ---------- task row ---------- */
  function Row({ t }: { t: Task }) {
    const tone = stageTone(t.vertical, t.stage);
    const dl = deadlineLabel(t);
    const last = !nextStage(t.vertical, t.stage);
    return (
      <div onClick={() => setOpenTask(t.id)} className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TONE_HEX[tone] }} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-slate-800">
            {t.isTicket && <TicketIcon />}<span className="truncate">{t.title}</span>
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          <span className="flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLIENT_COLOR[t.client] ?? "#8a8a95" }} />{t.client}</span>
          <span className="chip bg-slate-100 text-slate-600">{t.vertical}</span>
          <span className={`chip ${STAGE_CHIP[tone]}`}>{t.stage}</span>
        </div>
        <span className={`w-[80px] shrink-0 text-right text-[12px] font-medium tabular-nums ${DEADLINE_TEXT[dl.tone]}`}>{dl.text}</span>
        <span className="w-4 shrink-0"><PriorityFlag p={t.priority} /></span>
        <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-slate-500">{t.est}h</span>
        <button onClick={(e) => { e.stopPropagation(); move(t.id); }}
          className="ml-1 hidden shrink-0 items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 opacity-0 transition-all hover:bg-slate-200 hover:text-slate-900 group-hover:opacity-100 md:flex">
          {last ? "Complete" : "Move to next stage"} →
        </button>
      </div>
    );
  }

  const Section = ({ id, title, count, children, action }: { id: keyof typeof refs; title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) => (
    <section ref={refs[id]} className={`rounded-2xl transition-shadow ${flash === id ? "ring-2 ring-brand-500/50" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-700">{title}{count !== undefined && <span className="text-slate-500">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );

  const hasAny = scoped.length > 0;

  return (
    <div className="space-y-8">
      {/* ---------- header ---------- */}
      <header className="space-y-5">
        <div className="flex items-center gap-3.5">
          <Avatar photo={ME.photo} name={ME.fullName} size={44} />
          <div>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900">{greeting}, {ME.name}</h1>
            <p className="text-[13px] text-slate-500">{dateStr}</p>
          </div>
        </div>

        {/* stat chips */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Chip label="Overdue" value={overdue.length} tone={overdue.length ? "rose" : "slate"} onClick={() => goto("overdue")} />
          <Chip label="Due today" value={dueTodayCount} tone={dueTodayCount ? "amber" : "slate"} onClick={() => goto("today")} />
          <Chip label="In progress" value={inProgress} tone="slate" onClick={() => goto("today")} />
          <Chip label="This week’s load" value={`${weekLoad}h`} tone="slate" onClick={() => goto("week")} />
        </div>

        {/* capacity bar */}
        <div className="card px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-slate-500">This week’s capacity</p>
            <p className={`text-[12px] font-semibold tabular-nums ${loadTone === "rose" ? "text-rose-600" : loadTone === "amber" ? "text-amber-600" : "text-emerald-600"}`}>{weekLoad}h / {CAPACITY_H}h</p>
          </div>
          <span className="block h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full rounded-full transition-all" style={{ width: `${Math.min(100, loadPct)}%`, backgroundColor: loadTone === "rose" ? "#f43f5e" : loadTone === "amber" ? "#f59e0b" : "#10b981" }} />
          </span>
        </div>

        {/* single optional project filter */}
        <div className="flex items-center gap-2.5">
          <select className="input w-auto" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All campaigns</option>
            {allCampaigns(tasks).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </header>

      {!hasAny ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[20px]">🌱</div>
          <p className="text-[15px] font-medium text-slate-700">Nothing assigned yet</p>
          <p className="max-w-xs text-[13px] text-slate-500">Welcome aboard, {ME.name}. When work is assigned to you it’ll show up here — organised by what needs doing first.</p>
        </div>
      ) : (
        <>
          {/* ---------- overdue strip (always first, never collapsible) ---------- */}
          {overdue.length > 0 && (
            <div ref={refs.overdue} className={`overflow-hidden rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] transition-shadow ${flash === "overdue" ? "ring-2 ring-rose-500/50" : ""}`}>
              <div className="flex items-center gap-2 border-b border-rose-500/15 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                <p className="text-[13px] font-semibold text-rose-600">Overdue — clear these first</p>
                <span className="text-[12px] tabular-nums text-rose-600/70">{overdue.length}</span>
              </div>
              <div className="divide-y divide-rose-500/10">
                {overdue.map((t) => {
                  const rung = rungTag(t.escalation);
                  return (
                    <div key={t.id} onClick={() => setOpenTask(t.id)} className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-rose-500/[0.05]">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {t.isTicket && <TicketIcon />}
                        <p className="truncate text-[13px] font-medium text-slate-800">{t.title}</p>
                        {rung && <span className="chip bg-rose-500/90 text-white">{rung}</span>}
                      </div>
                      <span className="flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLIENT_COLOR[t.client] ?? "#8a8a95" }} />{t.client}</span>
                      <span className="text-[12px] font-semibold tabular-nums text-rose-600">{daysOverdue(t.due)}d overdue</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); move(t.id); }} className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900">Move stage →</button>
                        <button onClick={(e) => { e.stopPropagation(); toast(`Extension requested for “${t.title}”`); }} className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Request extension</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------- today ---------- */}
          <Section id="today" title="Today" count={today.length}>
            {today.length > 0 ? (
              <div className="card divide-y divide-slate-200 overflow-hidden">{today.map((t) => <Row key={t.id} t={t} />)}</div>
            ) : (
              <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
                <p className="text-[15px] font-medium text-slate-700">Done for today 🎉</p>
                {weekTasks[0] ? (<><p className="text-[12px] text-slate-500">Next up</p><div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200"><Row t={weekTasks[0]} /></div></>)
                  : <p className="text-[13px] text-slate-500">Nothing else on the horizon. Enjoy the calm.</p>}
              </div>
            )}
          </Section>

          {/* ---------- this week ---------- */}
          {weekDays.length > 0 && (
            <Section id="week" title="This week">
              <div className="space-y-4">
                {weekDays.map(({ due, list, hours }) => (
                  <div key={due}>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <p className="text-[12px] font-medium text-slate-600">{dayLabel(due)}</p>
                      <p className="text-[11px] tabular-nums text-slate-500">{hours}h</p>
                    </div>
                    <div className="card divide-y divide-slate-200 overflow-hidden">{list.map((t) => <Row key={t.id} t={t} />)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ---------- backlog ---------- */}
          {backlog.length > 0 && (
            <Section id="backlog" title="Backlog" count={backlog.length}
              action={<button onClick={() => setBacklogOpen((v) => !v)} className="btn-subtle text-[12px]">{backlogOpen ? "Hide" : "Show"}</button>}>
              {backlogOpen && <div className="card divide-y divide-slate-200 overflow-hidden">{backlog.map((t) => <Row key={t.id} t={t} />)}</div>}
            </Section>
          )}
        </>
      )}

      {/* ---------- task modal ---------- */}
      {current && <TaskModal t={current} onClose={() => setOpenTask(null)} onMove={() => move(current.id)} onExtend={() => { toast(`Extension requested for “${current.title}”`); }} />}

      {/* toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => <div key={t.id} className="animate-scale-in rounded-xl border border-slate-200 bg-canvas-raised px-4 py-2.5 text-[13px] text-slate-800 shadow-lift">{t.msg}</div>)}
      </div>
    </div>
  );
}

function Chip({ label, value, tone, onClick }: { label: string; value: React.ReactNode; tone: "rose" | "amber" | "slate"; onClick: () => void }) {
  const dot = tone === "rose" ? "bg-rose-600" : tone === "amber" ? "bg-amber-600" : "bg-slate-400";
  const val = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <button onClick={onClick} className="card-interactive flex items-center justify-between px-4 py-3 text-left">
      <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} /><span className="text-[12px] font-medium text-slate-500">{label}</span></span>
      <span className={`text-[18px] font-semibold tabular-nums ${val}`}>{value}</span>
    </button>
  );
}

/* ---------- task modal (existing drawer style) ---------- */
function TaskModal({ t, onClose, onMove, onExtend }: { t: Task; onClose: () => void; onMove: () => void; onExtend: () => void }) {
  const pipeline = PIPELINE[t.vertical] ?? [];
  const idx = stageIndex(t.vertical, t.stage);
  const dl = deadlineLabel(t);
  const last = !nextStage(t.vertical, t.stage);
  const rung = rungTag(t.escalation);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] animate-scale-in overflow-y-auto border-l border-slate-200 bg-canvas-raised p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {t.isTicket && <span className="chip bg-fuchsia-100 text-fuchsia-700">Ticket</span>}
              <span className={`chip ${dl.tone === "rose" ? "bg-rose-100 text-rose-700" : dl.tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{dl.text}</span>
              {rung && <span className="chip bg-rose-500/90 text-white">{rung}</span>}
            </div>
            <h3 className="mt-2.5 text-[17px] font-semibold tracking-tight text-slate-900">{t.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLIENT_COLOR[t.client] ?? "#8a8a95" }} />{t.client} · {t.campaign}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
        </div>

        {/* pipeline progress */}
        <div className="mt-6">
          <p className="mb-2 text-[12px] font-medium text-slate-500">{t.vertical} pipeline</p>
          <div className="space-y-1.5">
            {pipeline.map((s, i) => (
              <div key={s} className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < idx ? "bg-emerald-100 text-emerald-700" : i === idx ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-500"}`}>{i < idx ? "✓" : i + 1}</span>
                <span className={`text-[13px] ${i === idx ? "font-semibold text-slate-900" : i < idx ? "text-slate-500 line-through" : "text-slate-500"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-[13px]">
          {[["Vertical", t.vertical], ["Stage", t.stage], ["Priority", t.priority], ["Estimate", `${t.est}h`], ["Due", dl.tone === "slate" ? dayLabel(t.due) : dl.text]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-slate-200 pb-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium capitalize text-slate-800">{v}</dd></div>
          ))}
        </dl>

        <div className="mt-6 flex gap-2">
          <button onClick={() => { onMove(); onClose(); }} className="btn-primary flex-1">{last ? "Complete" : "Move to next stage"} →</button>
          {isOverdue(t) && <button onClick={onExtend} className="btn-ghost">Request extension</button>}
        </div>
      </aside>
    </>
  );
}
