"use client";

import { useMemo, useState } from "react";
import {
  BUSINESSES, DEALS, DIVISIONS, EXTENSIONS, INVOICES, NOW, PEOPLE, PROJECTS, TASKS, TRENDS,
  businessById, daysOverdue, fmtDate, money, moneyShort, isDueToday, isOverdue, personById, projectById, rungLabel,
  type Division, type Person, type Task,
} from "@/lib/commandData";

/* ---------- atoms ---------- */
function PersonAvatar({ person, size = 40 }: { person: Person; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cls = "rounded-full object-cover ring-2 ring-white";
  if (failed)
    return <div className={`${cls} flex items-center justify-center font-semibold text-white`} style={{ width: size, height: size, backgroundColor: "#6366f1", fontSize: size * 0.36 }}>{person.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>;
  return <img className={cls} style={{ width: size, height: size }} src={`https://i.pravatar.cc/120?img=${person.photo}`} alt={person.name} onError={() => setFailed(true)} />;
}
const TONE = {
  red: "bg-rose-100 text-rose-700", amber: "bg-amber-100 text-amber-800", green: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-100 text-slate-500", blue: "bg-sky-100 text-sky-700",
} as const;
function Dot({ tone }: { tone: "red" | "amber" | "green" }) {
  const c = tone === "red" ? "bg-rose-600" : tone === "amber" ? "bg-amber-600" : "bg-emerald-600";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}
function Bar({ value, tone = "brand" }: { value: number; tone?: "brand" | "amber" | "rose" | "emerald" }) {
  const c = tone === "amber" ? "bg-amber-600" : tone === "rose" ? "bg-rose-600" : tone === "emerald" ? "bg-emerald-600" : "bg-brand-500";
  return <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-200"><span className={`block h-full rounded-full ${c}`} style={{ width: `${Math.min(100, value)}%` }} /></span>;
}

/* ================================================================= */
export default function CommandCenter() {
  const [fDiv, setFDiv] = useState<Division | "all">("all");
  const [fBiz, setFBiz] = useState<string>("all");
  const [sort, setSort] = useState<"overdue" | "division" | "capacity">("overdue");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selPerson, setSelPerson] = useState<string | null>(null);
  const [selTask, setSelTask] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected" | "done">>({});
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const toast = (msg: string) => { const id = Math.floor(NOW.getTime() % 1e6) + toasts.length + Math.floor(performance.now()); setToasts((t) => [...t, { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600); };
  const match = (division: Division, businessId: string) => (fDiv === "all" || division === fDiv) && (fBiz === "all" || businessId === fBiz);
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bizOptions = BUSINESSES.filter((b) => fDiv === "all" || b.division === fDiv);
  const tasks = useMemo(() => TASKS.filter((t) => match(t.division, t.businessId)), [fDiv, fBiz]);
  const projects = useMemo(() => PROJECTS.filter((p) => match(p.division, p.businessId)), [fDiv, fBiz]);

  /* ---- KPIs ---- */
  const overdue = tasks.filter(isOverdue);
  const ceoRung = overdue.filter((t) => t.escalation >= 3).length;
  const dueToday = tasks.filter((t) => t.status !== "done" && isDueToday(t.due) && !isOverdue(t));
  const health = { on: projects.filter((p) => p.health === "on_track").length, risk: projects.filter((p) => p.health === "at_risk").length, delayed: projects.filter((p) => p.health === "delayed").length };
  const pipeline = DEALS.filter((d) => match(d.division, d.businessId) && d.stage !== "Lost").reduce((s, d) => s + d.value, 0);
  const receivables = INVOICES.filter((i) => match(i.division, i.businessId) && i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  /* ---- Digest ---- */
  type Row = { key: string; sev: "MISSED" | "MONEY" | "TODAY" | "BLOCKED" | "STALE" | "WINS"; text: React.ReactNode; meta: React.ReactNode; taskId?: string; personId?: string; ext?: string };
  const rows: Row[] = [];
  [...overdue].sort((a, b) => daysOverdue(b.due) - daysOverdue(a.due)).forEach((t) => {
    const ext = EXTENSIONS.find((e) => e.taskId === t.id);
    rows.push({ key: t.id, sev: "MISSED", taskId: t.id, personId: t.assigneeId, ext: ext && !resolved[ext.id] ? ext.id : undefined,
      text: <><b className="text-slate-800">{personById(t.assigneeId).name}</b> · {t.title}</>,
      meta: <>{businessById(t.businessId).name} · {daysOverdue(t.due)}d overdue · <span className="text-rose-600">{rungLabel(t.escalation)}</span></> });
  });
  INVOICES.filter((i) => match(i.division, i.businessId) && i.status === "overdue" && !resolved["inv-" + i.id]).forEach((i) =>
    rows.push({ key: "m-" + i.id, sev: "MONEY", text: <><b className="text-slate-800">{money(i.amount)}</b> overdue · {businessById(i.businessId).name}</>, meta: <>{i.label} · was due {fmtDate(i.due)}</> }));
  dueToday.forEach((t) => rows.push({ key: "td-" + t.id, sev: "TODAY", taskId: t.id, personId: t.assigneeId,
    text: <><b className="text-slate-800">{personById(t.assigneeId).name}</b> · {t.title}</>, meta: <>{businessById(t.businessId).name} · {t.stage}</> }));
  tasks.filter((t) => t.status === "blocked").forEach((t) => rows.push({ key: "bl-" + t.id, sev: "BLOCKED", taskId: t.id, personId: t.assigneeId,
    text: <><b className="text-slate-800">{personById(t.assigneeId).name}</b> · {t.title}</>, meta: <>Blocked — {t.blockedReason}</> }));
  DEALS.filter((d) => match(d.division, d.businessId) && daysOverdue(d.lastActivity) >= 5 && !d.wonAwaitingConversion).forEach((d) =>
    rows.push({ key: "st-" + d.id, sev: "STALE", text: <><b className="text-slate-800">{d.name}</b> · {money(d.value)}</>, meta: <>No activity for {daysOverdue(d.lastActivity)}d · {d.stage}</> }));
  tasks.filter((t) => t.status === "done" && !!t.completedAt && t.completedAt <= t.due).forEach((t) =>
    rows.push({ key: "w-" + t.id, sev: "WINS", personId: t.assigneeId, text: <><b className="text-slate-800">{personById(t.assigneeId).name}</b> · {t.title}</>, meta: <>Delivered on time · {businessById(t.businessId).name}</> }));

  /* ---- People ---- */
  const scopedPeople = useMemo(() => {
    return PEOPLE.map((p) => {
      const myTasks = tasks.filter((t) => t.assigneeId === p.id);
      const active = myTasks.filter((t) => t.status !== "done");
      const current = [...active].sort((a, b) => (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || (isDueToday(a.due) ? -1 : 1))[0];
      const state: "red" | "amber" | "green" = current ? (isOverdue(current) ? "red" : current.status === "blocked" || isDueToday(current.due) ? "amber" : "green") : "green";
      return { p, current, state, overdueCount: active.filter(isOverdue).length, inScope: fDiv === "all" && fBiz === "all" ? true : myTasks.length > 0 };
    }).filter((x) => x.inScope);
  }, [fDiv, fBiz]);
  const peopleSorted = useMemo(() => {
    const arr = [...scopedPeople];
    if (sort === "overdue") arr.sort((a, b) => b.overdueCount - a.overdueCount || (b.p.loadH / b.p.capacityH) - (a.p.loadH / a.p.capacityH));
    if (sort === "division") arr.sort((a, b) => a.p.role.localeCompare(b.p.role));
    if (sort === "capacity") arr.sort((a, b) => (a.p.loadH / a.p.capacityH) - (b.p.loadH / b.p.capacityH));
    return arr;
  }, [scopedPeople, sort]);

  /* ---- Business health tree ---- */
  const bizRows = BUSINESSES.filter((b) => (fDiv === "all" || b.division === fDiv) && (fBiz === "all" || b.id === fBiz))
    .map((b) => {
      const projs = PROJECTS.filter((p) => p.businessId === b.id);
      const over = TASKS.filter((t) => t.businessId === b.id && isOverdue(t)).length;
      const nextMs = projs.map((p) => p.milestone).sort((a, b) => a.date.localeCompare(b.date))[0];
      const pipe = DEALS.filter((d) => d.businessId === b.id && d.stage !== "Lost").reduce((s, d) => s + d.value, 0);
      const recv = INVOICES.filter((i) => i.businessId === b.id && (i.status === "overdue" || i.status === "sent")).reduce((s, i) => s + i.amount, 0);
      return { b, projs, over, nextMs, pipe, recv };
    }).filter((r) => r.projs.length > 0 || r.pipe > 0 || r.recv > 0);

  /* ---- Decision queue ---- */
  type Dec = { id: string; kind: string; title: React.ReactNode; sub: React.ReactNode; approvable: boolean };
  const decisions: Dec[] = [];
  TASKS.filter((t) => match(t.division, t.businessId) && t.escalation >= 3 && isOverdue(t) && !resolved["dec-esc-" + t.id]).forEach((t) =>
    decisions.push({ id: "dec-esc-" + t.id, kind: "Escalation", approvable: false, title: <>Forced review — {t.title}</>, sub: <>{personById(t.assigneeId).name} · {businessById(t.businessId).name} · {daysOverdue(t.due)}d overdue</> }));
  EXTENSIONS.filter((e) => { const t = TASKS.find((x) => x.id === e.taskId)!; return match(t.division, t.businessId) && !resolved[e.id]; }).forEach((e) => {
    const t = TASKS.find((x) => x.id === e.taskId)!;
    decisions.push({ id: e.id, kind: "Extension", approvable: true, title: <>+{e.extraDays}d on “{t.title}”</>, sub: <>{personById(e.requestedBy).name} · {e.reason}</> });
  });
  DEALS.filter((d) => match(d.division, d.businessId) && d.wonAwaitingConversion && !resolved["dec-" + d.id]).forEach((d) =>
    decisions.push({ id: "dec-" + d.id, kind: "Conversion", approvable: true, title: <>Convert won deal — {d.name}</>, sub: <>{money(d.value)} · awaiting sign-off</> }));
  INVOICES.filter((i) => match(i.division, i.businessId) && i.needsApproval && !resolved["dec-" + i.id]).forEach((i) =>
    decisions.push({ id: "dec-" + i.id, kind: "Invoice", approvable: true, title: <>Approve invoice — {money(i.amount)}</>, sub: <>{businessById(i.businessId).name} · {i.label}</> }));

  const dateHeader = NOW.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const sevBadge = (s: Row["sev"]) => {
    const map: Record<Row["sev"], keyof typeof TONE> = { MISSED: "red", MONEY: "red", TODAY: "amber", BLOCKED: "amber", STALE: "amber", WINS: "green" };
    return <span className={`chip ${TONE[map[s]]} w-[68px] justify-center`}>{s}</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header + filters */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1.5 text-[13px] font-medium tracking-tight text-slate-500">{dateHeader}</p>
            <h1 className="text-[30px] font-semibold leading-none tracking-tight text-slate-900">Command Center</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] text-slate-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" /> Live
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[{ id: "all", label: "All" }, ...DIVISIONS].map((d) => (
              <button key={d.id} onClick={() => { setFDiv(d.id as Division | "all"); setFBiz("all"); }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-tight transition-colors ${fDiv === d.id ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>{d.label}</button>
            ))}
          </div>
          <select className="input w-auto" value={fBiz} onChange={(e) => setFBiz(e.target.value)}>
            <option value="all">All businesses</option>
            {bizOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </header>

      {/* ZONE 1 — Status strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <a href="#digest" className="card-interactive px-5 py-4">
          <div className="flex items-center gap-1.5"><Dot tone="red" /><p className="text-[11px] font-medium text-slate-500">Deadlines crossed</p></div>
          <p className={`mt-2 text-[28px] font-semibold leading-none tabular-nums ${overdue.length ? "text-rose-600" : "text-slate-900"}`}>{overdue.length}</p>
          <p className="mt-1.5 text-[12px] text-slate-500">{ceoRung} at CEO rung</p>
        </a>
        <a href="#digest" className="card-interactive px-5 py-4">
          <div className="flex items-center gap-1.5"><Dot tone="amber" /><p className="text-[11px] font-medium text-slate-500">Due today</p></div>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-slate-900">{dueToday.length}</p>
          <p className="mt-1.5 text-[12px] text-slate-500">across {new Set(dueToday.map((t) => t.assigneeId)).size} people</p>
        </a>
        <a href="#health" className="card-interactive px-5 py-4">
          <p className="text-[11px] font-medium text-slate-500">Active projects</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-slate-900">{projects.length}</p>
          <p className="mt-1.5 flex items-center gap-2 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1"><Dot tone="green" />{health.on}</span>
            <span className="inline-flex items-center gap-1"><Dot tone="amber" />{health.risk}</span>
            <span className="inline-flex items-center gap-1"><Dot tone="red" />{health.delayed}</span>
          </p>
        </a>
        <div className="card px-5 py-4">
          <p className="text-[11px] font-medium text-slate-500">Open pipeline</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tabular-nums text-slate-900">{money(pipeline)}</p>
          <p className="mt-1.5 text-[12px] text-slate-500">{DEALS.filter((d) => match(d.division, d.businessId) && d.stage !== "Lost").length} open deals</p>
        </div>
        <a href="#health" className="card-interactive col-span-2 px-5 py-4 lg:col-span-1">
          <div className="flex items-center gap-1.5"><Dot tone="red" /><p className="text-[11px] font-medium text-slate-500">Overdue receivables</p></div>
          <p className={`mt-2 text-[28px] font-semibold leading-none tabular-nums ${receivables > 0 ? "text-rose-600" : "text-slate-900"}`}>{money(receivables)}</p>
          <p className="mt-1.5 text-[12px] text-slate-500">{INVOICES.filter((i) => match(i.division, i.businessId) && i.status === "overdue").length} invoice(s)</p>
        </a>
      </div>

      {/* ZONE 2 — Morning digest */}
      <section id="digest">
        <div className="mb-4 flex items-end justify-between">
          <div><h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Morning digest</h2><p className="mt-0.5 text-[12px] text-slate-500">Auto-generated · worst first</p></div>
          <button onClick={() => toast("Digest history — coming soon")} className="text-[12px] text-slate-500 hover:text-slate-800">Digest history →</button>
        </div>
        <div className="card overflow-hidden">
          {rows.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-slate-500">Nothing to report in this view.</p> : (
            <div className="panel-divide">
              {rows.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                  {sevBadge(r.sev)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-slate-700">{r.text}</p>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">{r.meta}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.ext && <>
                      <button onClick={() => { setResolved((s) => ({ ...s, [r.ext!]: "approved" })); toast("Extension approved"); }} className="btn-subtle text-[12px] text-emerald-700">Approve</button>
                      <button onClick={() => { setResolved((s) => ({ ...s, [r.ext!]: "rejected" })); toast("Extension rejected"); }} className="btn-subtle text-[12px] text-rose-600">Reject</button>
                    </>}
                    {r.personId && <button onClick={() => toast(`Pinged ${personById(r.personId!).name}`)} className="btn-subtle text-[12px]">Ping</button>}
                    {r.taskId && <button onClick={() => setSelTask(r.taskId!)} className="btn-subtle text-[12px]">Open</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ZONE 3 — Who's on what */}
      <section id="people">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Who’s on what, right now</h2><p className="mt-0.5 text-[12px] text-slate-500">{peopleSorted.length} people across every business</p></div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[12px]">
            {([["overdue", "Most overdue"], ["division", "By role"], ["capacity", "Free capacity"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)} className={`rounded-md px-2.5 py-1 font-medium transition-colors ${sort === k ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {peopleSorted.map(({ p, current, state }) => {
            const pct = Math.round((p.loadH / p.capacityH) * 100);
            return (
              <button key={p.id} onClick={() => setSelPerson(p.id)} className="card-interactive p-4 text-left">
                <div className="flex items-center gap-3">
                  <PersonAvatar person={p} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{p.name}</p>
                    <p className="truncate text-[11.5px] text-slate-500">{p.role}</p>
                  </div>
                  <Dot tone={state} />
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                  <p className="truncate text-[12px] font-medium text-slate-800">{current ? current.title : "No active task"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{current ? current.stage : "—"}</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1"><Bar value={pct} tone={pct > 100 ? "rose" : pct >= 90 ? "amber" : "brand"} /></div>
                  <span className={`text-[11px] tabular-nums ${pct > 100 ? "text-rose-600" : "text-slate-500"}`}>{p.loadH}h / {p.capacityH}h</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ZONE 4 — Business health board */}
      <section id="health">
        <div className="mb-4"><h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Business health board</h2><p className="mt-0.5 text-[12px] text-slate-500">Division → business → project → vertical</p></div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-slate-200">
              {["Business", "Projects", "Overdue", "Next milestone", "Pipeline", "Receivables"].map((h) => <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500">{h}</th>)}
            </tr></thead>
            <tbody className="panel-divide">
              {bizRows.map(({ b, projs, over, nextMs, pipe, recv }) => (
                <BizGroup key={b.id} b={b} projs={projs} over={over} nextMs={nextMs} pipe={pipe} recv={recv} expanded={expanded} toggle={toggle} />
              ))}
              {bizRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-slate-500">No businesses in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* ZONE 5 — Needs your decision */}
      <section id="decisions">
        <div className="mb-4"><h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Needs your decision</h2><p className="mt-0.5 text-[12px] text-slate-500">Only you can clear these</p></div>
        {decisions.length === 0 ? (
          <div className="card flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
            <p className="text-[14px] font-medium text-slate-700">Nothing needs you — enjoy</p>
            <p className="text-[12px] text-slate-500">The queue is clear across this view.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="card flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="chip bg-slate-100 text-slate-500 w-[92px] justify-center">{d.kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{d.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">{d.sub}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {d.approvable && <>
                    <button onClick={() => { setResolved((s) => ({ ...s, [d.id]: "approved" })); toast("Approved"); }} className="btn-primary text-[12px]">Approve</button>
                    <button onClick={() => { setResolved((s) => ({ ...s, [d.id]: "rejected" })); toast("Rejected"); }} className="btn-ghost text-[12px]">Reject</button>
                  </>}
                  {!d.approvable && <button onClick={() => { setResolved((s) => ({ ...s, [d.id]: "done" })); toast("Marked reviewed"); }} className="btn-primary text-[12px]">Review</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ZONE 6 — Trends strip */}
      <section>
        <div className="mb-4"><h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Trends</h2></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="card px-5 py-4">
            <p className="text-[11px] font-medium text-slate-500">On-time delivery · this week</p>
            <p className="mt-2 flex items-baseline gap-2"><span className="text-[24px] font-semibold tabular-nums text-slate-900">{TRENDS.onTimeThisWeek}%</span>
              <span className={`text-[12px] ${TRENDS.onTimeThisWeek >= TRENDS.onTimeLastWeek ? "text-emerald-600" : "text-rose-600"}`}>{TRENDS.onTimeThisWeek >= TRENDS.onTimeLastWeek ? "▲" : "▼"} {Math.abs(TRENDS.onTimeThisWeek - TRENDS.onTimeLastWeek)} pts</span></p>
            <p className="mt-1 text-[11px] text-slate-500">vs {TRENDS.onTimeLastWeek}% last week</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-[11px] font-medium text-slate-500">Slowest pipeline stage</p>
            <p className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900">{TRENDS.slowestStage.name}</p>
            <p className="mt-1 text-[11px] text-slate-500">{TRENDS.slowestStage.avgDays}d avg · from activity log</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-[11px] font-medium text-slate-500">Avg team utilization</p>
            <p className="mt-2 text-[24px] font-semibold tabular-nums text-slate-900">{TRENDS.utilization}%</p>
            <div className="mt-2"><Bar value={TRENDS.utilization} tone={TRENDS.utilization >= 90 ? "amber" : "brand"} /></div>
          </div>
          <div className="card px-5 py-4">
            <p className="text-[11px] font-medium text-slate-500">Billed vs collected · this month</p>
            <div className="mt-2.5 space-y-2">
              <div><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Billed</span><span className="tabular-nums text-slate-700">{moneyShort(TRENDS.billed)}</span></div><Bar value={100} tone="brand" /></div>
              <div><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Collected</span><span className="tabular-nums text-slate-700">{moneyShort(TRENDS.collected)}</span></div><Bar value={(TRENDS.collected / TRENDS.billed) * 100} tone="emerald" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Person task-sheet panel */}
      {selPerson && <PersonPanel personId={selPerson} onClose={() => setSelPerson(null)} onPing={() => toast(`Pinged ${personById(selPerson).name}`)} onOpenTask={(id) => { setSelTask(id); }} />}
      {/* Task drawer */}
      {selTask && <TaskDrawer taskId={selTask} onClose={() => setSelTask(null)} />}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => <div key={t.id} className="animate-scale-in rounded-xl border border-slate-200 bg-canvas-raised px-4 py-2.5 text-[13px] text-slate-800 shadow-lift">{t.msg}</div>)}
      </div>
    </div>
  );
}

/* ---------- Business health group row (expandable) ---------- */
function BizGroup({ b, projs, over, nextMs, pipe, recv, expanded, toggle }: any) {
  const open = expanded.has("b:" + b.id);
  return (
    <>
      <tr className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => toggle("b:" + b.id)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}><polyline points="9 6 15 12 9 18" /></svg>
            <span className="text-[13px] font-medium text-slate-900">{b.name}</span>
            <span className="chip bg-slate-100 text-slate-500 px-1.5 py-0 text-[10px]">{b.kind}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">{projs.length}</td>
        <td className="px-4 py-3 text-[13px] tabular-nums">{over > 0 ? <span className="text-rose-600">{over}</span> : <span className="text-slate-500">0</span>}</td>
        <td className="px-4 py-3 text-[13px] text-slate-700">{nextMs ? <>{nextMs.name} · <span className="text-slate-500">{fmtDate(nextMs.date)}</span></> : "—"}</td>
        <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">{pipe ? money(pipe) : "—"}</td>
        <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">{recv ? money(recv) : "—"}</td>
      </tr>
      {open && projs.map((p: any) => <ProjRow key={p.id} p={p} expanded={expanded} toggle={toggle} />)}
    </>
  );
}
function ProjRow({ p, expanded, toggle }: any) {
  const open = expanded.has("p:" + p.id);
  const tone = p.health === "delayed" ? "red" : p.health === "at_risk" ? "amber" : "green";
  return (
    <>
      <tr className="cursor-pointer bg-slate-50 transition-colors hover:bg-slate-50" onClick={() => toggle("p:" + p.id)}>
        <td className="px-4 py-2.5 pl-10">
          <div className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}><polyline points="9 6 15 12 9 18" /></svg>
            <Dot tone={tone as any} /><span className="text-[12.5px] text-slate-700">{p.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-[12px] text-slate-500" colSpan={2}>{p.verticals.length} verticals</td>
        <td className="px-4 py-2.5 text-[12px] text-slate-500">{p.milestone.name} · {fmtDate(p.milestone.date)}</td>
        <td className="px-4 py-2.5" colSpan={2}></td>
      </tr>
      {open && p.verticals.map((v: any) => (
        <tr key={v.name} className="bg-slate-50">
          <td className="px-4 py-2 pl-[68px] text-[12px] text-slate-600">{v.name}</td>
          <td className="px-4 py-2" colSpan={3}><div className="flex items-center gap-2"><div className="w-40"><Bar value={v.progress} tone={v.progress === 100 ? "emerald" : "brand"} /></div><span className="text-[11px] tabular-nums text-slate-500">{v.progress}%</span></div></td>
          <td colSpan={2}></td>
        </tr>
      ))}
    </>
  );
}

/* ---------- Person task-sheet panel ---------- */
function PersonPanel({ personId, onClose, onPing, onOpenTask }: { personId: string; onClose: () => void; onPing: () => void; onOpenTask: (id: string) => void }) {
  const p = personById(personId);
  const myTasks = TASKS.filter((t) => t.assigneeId === personId);
  const active = myTasks.filter((t) => t.status !== "done");
  const pct = Math.round((p.loadH / p.capacityH) * 100);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] animate-scale-in overflow-y-auto border-l border-slate-200 bg-canvas-raised p-6 shadow-lift">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5"><PersonAvatar person={p} size={60} /><div><p className="text-[17px] font-semibold tracking-tight text-slate-900">{p.name}</p><p className="text-[13px] text-slate-500">{p.role}</p></div></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1"><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Today’s load</span><span className={`tabular-nums ${pct > 100 ? "text-rose-600" : "text-slate-700"}`}>{p.loadH}h / {p.capacityH}h</span></div><Bar value={pct} tone={pct > 100 ? "rose" : pct >= 90 ? "amber" : "brand"} /></div>
          <button onClick={onPing} className="btn-subtle text-[12px]">Ping</button>
        </div>
        <p className="mt-6 mb-2 text-[13px] font-semibold text-slate-800">Task sheet · {active.length} open</p>
        <div className="space-y-2">
          {myTasks.map((t) => {
            const st = t.status === "done" ? "green" : isOverdue(t) ? "red" : (t.status === "blocked" || isDueToday(t.due)) ? "amber" : "green";
            return (
              <button key={t.id} onClick={() => onOpenTask(t.id)} className="card w-full px-3.5 py-3 text-left transition-colors hover:border-slate-300">
                <div className="flex items-center gap-2">
                  <Dot tone={st as any} /><p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{t.title}</p>
                  {t.status === "done" ? <span className="chip bg-emerald-100 text-emerald-700">Done</span> : <span className="text-[11px] text-slate-500">{fmtDate(t.due)}</span>}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{businessById(t.businessId).name} · {t.vertical} → {t.stage}</p>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}

/* ---------- Task drawer ---------- */
function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const t = TASKS.find((x) => x.id === taskId)!;
  const p = personById(t.assigneeId);
  const st = t.status === "done" ? ["Delivered", "green"] : isOverdue(t) ? [`${daysOverdue(t.due)}d overdue`, "red"] : isDueToday(t.due) ? ["Due today", "amber"] : ["On track", "green"];
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] animate-scale-in overflow-y-auto border-l border-slate-200 bg-canvas-raised p-6 shadow-lift">
        <div className="flex items-start justify-between">
          <div><span className={`chip ${TONE[(st[1] === "red" ? "red" : st[1] === "amber" ? "amber" : "green") as keyof typeof TONE]}`}>{st[0]}</span><p className="mt-2.5 text-[17px] font-semibold tracking-tight text-slate-900">{t.title}</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
        </div>
        <dl className="mt-6 space-y-3 text-[13px]">
          {[["Assignee", p.name], ["Business", businessById(t.businessId).name], ["Project", projectById(t.projectId).name], ["Vertical", t.vertical], ["Stage", t.stage], ["Due", fmtDate(t.due)], ["Escalation", rungLabel(t.escalation)]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-slate-200 pb-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>
          ))}
          {t.blockedReason && <div className="rounded-xl bg-amber-100 px-3.5 py-2.5 text-amber-800">Blocked — {t.blockedReason}</div>}
        </dl>
      </aside>
    </>
  );
}
