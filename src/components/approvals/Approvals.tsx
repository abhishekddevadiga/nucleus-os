"use client";

import { useMemo, useState } from "react";
import {
  CLIENT_COLOR, ME, NOW, canNudge, fmtDate, seedHistory, seedPending, seedRequested, waitLabel, whenLabel,
  type Approval, type Decision, type Kind, type Requested,
} from "@/lib/approvalsData";

/* ---------- atoms ---------- */
function Avatar({ photo, name, size = 26 }: { photo: number; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cls = "rounded-full object-cover ring-2 ring-white";
  if (failed) return <div className={`${cls} flex items-center justify-center bg-indigo-500 font-semibold text-white`} style={{ width: size, height: size, fontSize: size * 0.4 }}>{name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>;
  return <img className={cls} style={{ width: size, height: size }} src={`https://i.pravatar.cc/120?img=${photo}`} alt={name} onError={() => setFailed(true)} />;
}
function ClientTag({ client }: { client: string }) {
  return <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLIENT_COLOR[client] ?? "#8a8a95" }} />{client}</span>;
}
function StageArrow({ from, to }: { from?: string; to?: string }) {
  if (!from || !to) return null;
  return <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="chip bg-amber-100 text-amber-800">{from}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg><span className="chip bg-emerald-100 text-emerald-700">{to}</span></span>;
}
const ASSET_ICON: Record<string, string> = { video: "▶", doc: "▤", link: "🔗", pr: "⌥" };
function AssetChip({ label, type, onClick }: { label: string; type: string; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800">
      <span className="text-[11px] text-slate-500">{ASSET_ICON[type] ?? "🔗"}</span>{label}<span className="text-slate-500">↗</span>
    </button>
  );
}
const KIND_LABEL: Record<Kind, string> = { stage: "Stage approvals", extension: "Extensions", ticket: "Tickets" };

/* ================================================================= */
export default function Approvals() {
  const [pending, setPending] = useState<Approval[]>(() => seedPending());
  const [requested, setRequested] = useState<Requested[]>(() => seedRequested());
  const [history, setHistory] = useState<Decision[]>(() => seedHistory());
  const [tab, setTab] = useState<"pending" | "requested" | "history">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  function toast(msg: string) { const id = Math.floor(NOW.getTime() % 1e6) + toasts.length + Math.floor(performance.now()); setToasts((t) => [...t, { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600); }

  const staleCount = pending.filter((a) => waitLabel(a.arrivedAt).stale).length;
  const grouped = useMemo(() => {
    const order: Kind[] = ["stage", "extension", "ticket"];
    return order.map((k) => ({ kind: k, items: pending.filter((a) => a.kind === k).sort((x, y) => x.arrivedAt.localeCompare(y.arrivedAt)) })).filter((g) => g.items.length > 0);
  }, [pending]);

  /* ---------- decisions (write to the log) ---------- */
  function logFor(a: Approval, action: "approved" | "rejected", reasonText?: string): Decision {
    const base = { id: "d-" + a.id + "-" + action, kind: a.kind, title: a.title, client: a.client, decidedAt: NOW.toISOString(), decider: ME.name, action };
    if (a.kind === "stage") return { ...base, from: a.stage, to: action === "approved" ? a.nextStage : undefined, reason: reasonText };
    if (a.kind === "extension") return { ...base, from: a.oldDate ? fmtDate(a.oldDate) : undefined, to: action === "approved" && a.newDate ? fmtDate(a.newDate) : undefined, reason: reasonText };
    return { ...base, from: "Triaged", to: action === "approved" ? "Approved" : undefined, reason: reasonText };
  }
  function approve(id: string) {
    const a = pending.find((x) => x.id === id); if (!a) return;
    setHistory((h) => [logFor(a, "approved"), ...h]);
    setPending((p) => p.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    toast(a.kind === "stage" ? `Approved — moved to ${a.nextStage}` : a.kind === "extension" ? `Extension approved — new deadline ${fmtDate(a.newDate!)}` : "Ticket approved");
  }
  function reject(id: string, reasonText: string) {
    const a = pending.find((x) => x.id === id); if (!a) return;
    setHistory((h) => [logFor(a, "rejected", reasonText), ...h]);
    setPending((p) => p.filter((x) => x.id !== id));
    setRejecting(null); setReason("");
    toast(`Rejected — ${a.title}`);
  }
  function approveSelected() {
    const ids = [...selected]; const items = pending.filter((x) => selected.has(x.id));
    setHistory((h) => [...items.map((a) => logFor(a, "approved")), ...h]);
    setPending((p) => p.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    toast(`Approved ${ids.length} item${ids.length === 1 ? "" : "s"}`);
  }
  function nudge(id: string) {
    setRequested((r) => r.map((x) => x.id === id ? { ...x, nudgedAt: NOW.toISOString() } : x));
    const it = requested.find((x) => x.id === id);
    toast(`Reminder sent to ${it?.approver.name ?? "approver"}`);
  }

  const openApproval = openId ? pending.find((a) => a.id === openId) ?? null : null;
  const tabs = [
    { id: "pending" as const, label: "Pending for me", count: pending.length, red: staleCount > 0 },
    { id: "requested" as const, label: "Requested by me", count: requested.length, red: false },
    { id: "history" as const, label: "History", count: history.length, red: false },
  ];

  return (
    <div className="space-y-7">
      <header className="space-y-5">
        <div>
          <h1 className="text-[28px] font-semibold leading-none tracking-tight text-slate-900">Approvals</h1>
          <p className="mt-2.5 text-[14px] text-slate-500">Everything waiting on your decision — one place, one click, fully logged.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium tracking-tight transition-colors ${tab === t.id ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
              {t.label}
              <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${t.red ? "bg-rose-500/90 text-white" : "bg-slate-200 text-slate-600"}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ---------------- PENDING ---------------- */}
      {tab === "pending" && (
        pending.length === 0 ? (
          <EmptyState title="Nothing needs you" hint="Every approval is cleared. New requests will land here the moment they’re raised." />
        ) : (
          <div className="space-y-8 pb-20">
            {grouped.map((g) => (
              <section key={g.kind}>
                <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-700">{KIND_LABEL[g.kind]}<span className="text-slate-500">{g.items.length}</span></h2>
                <div className="space-y-3">
                  {g.items.map((a) => (
                    <ApprovalCard key={a.id} a={a}
                      selected={selected.has(a.id)} onToggle={() => setSelected((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                      rejecting={rejecting === a.id} reason={reason} setReason={setReason}
                      onOpen={() => setOpenId(a.id)} onApprove={() => approve(a.id)}
                      onStartReject={() => { setRejecting(a.id); setReason(""); }} onCancelReject={() => setRejecting(null)}
                      onConfirmReject={() => reject(a.id, reason.trim())} onAsset={() => toast(`Opening ${a.asset?.label}`)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {/* ---------------- REQUESTED BY ME ---------------- */}
      {tab === "requested" && (
        requested.length === 0 ? <EmptyState title="Nothing outstanding" hint="You’re not waiting on anyone right now." /> : (
          <div className="space-y-3">
            {requested.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-slate-900">{r.title}</p>
                      {r.vertical && <span className="chip bg-slate-100 text-slate-600">{r.vertical}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"><ClientTag client={r.client} />{r.kind === "stage" ? <StageArrow from={r.stage} to={r.nextStage} /> : r.oldDate && <span className="text-[12px] text-slate-500">{fmtDate(r.oldDate)} → <span className="text-slate-700">{fmtDate(r.newDate!)}</span></span>}</div>
                    <div className="mt-2.5 flex items-center gap-2 text-[12px] text-slate-500"><Avatar photo={r.approver.photo} name={r.approver.name} size={22} />Waiting on <span className="text-slate-700">{r.approver.name}</span> · sent {whenLabel(r.sentAt)}</div>
                  </div>
                  <button disabled={!canNudge(r.nudgedAt)} onClick={() => nudge(r.id)}
                    className="btn-ghost text-[12px] disabled:opacity-40">{canNudge(r.nudgedAt) ? "Nudge" : "Nudged"}</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ---------------- HISTORY ---------------- */}
      {tab === "history" && (
        <div className="card overflow-hidden">
          <div className="panel-divide">
            {history.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`chip w-[76px] justify-center ${d.action === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{d.action === "approved" ? "Approved" : "Rejected"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{d.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    <ClientTag client={d.client} />
                    {d.from && <span> · {d.from}{d.to ? ` → ${d.to}` : ""}</span>}
                    {d.action === "rejected" && d.reason && <span className="text-rose-600"> · “{d.reason}”</span>}
                  </p>
                </div>
                <span className="text-[12px] text-slate-500">{d.decider} · {whenLabel(d.decidedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- sticky batch bar ---------------- */}
      {tab === "pending" && selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-300 bg-canvas-raised py-2.5 pl-4 pr-2.5 shadow-lift md:left-[calc(50%+120px)]">
          <span className="text-[13px] text-slate-600">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="btn-subtle text-[12px]">Clear</button>
          <button onClick={approveSelected} className="btn-primary text-[13px]">✓ Approve selected ({selected.size})</button>
        </div>
      )}

      {/* ---------------- modal ---------------- */}
      {openApproval && <ApprovalModal a={openApproval} onClose={() => setOpenId(null)} onApprove={() => { approve(openApproval.id); setOpenId(null); }} onReject={() => { setOpenId(null); setRejecting(openApproval.id); setReason(""); }} />}

      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => <div key={t.id} className="animate-scale-in rounded-xl border border-slate-200 bg-canvas-raised px-4 py-2.5 text-[13px] text-slate-800 shadow-lift">{t.msg}</div>)}
      </div>
    </div>
  );
}

/* ---------- approval card ---------- */
function ApprovalCard({ a, selected, onToggle, rejecting, reason, setReason, onOpen, onApprove, onStartReject, onCancelReject, onConfirmReject, onAsset }: {
  a: Approval; selected: boolean; onToggle: () => void; rejecting: boolean; reason: string; setReason: (v: string) => void;
  onOpen: () => void; onApprove: () => void; onStartReject: () => void; onCancelReject: () => void; onConfirmReject: () => void; onAsset: () => void;
}) {
  const w = waitLabel(a.arrivedAt);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div onClick={onOpen} className={`card group relative cursor-pointer p-4 transition-colors hover:border-slate-300 ${selected ? "ring-2 ring-brand-500/50" : ""}`}>
      {/* hover checkbox for batch */}
      <label onClick={stop} className={`absolute -left-2.5 top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-opacity ${selected ? "border-brand-500 bg-brand-500 opacity-100" : "border-slate-300 bg-canvas-raised opacity-0 group-hover:opacity-100"}`}>
        <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} />
        {selected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </label>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-slate-900">{a.title}</p>
            {a.vertical && <span className="chip bg-slate-100 text-slate-600">{a.vertical}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ClientTag client={a.client} />
            {a.kind === "stage" && <StageArrow from={a.stage} to={a.nextStage} />}
            {a.kind === "ticket" && <span className="chip bg-fuchsia-100 text-fuchsia-700">Ticket</span>}
          </div>
        </div>
        <span className={`shrink-0 text-[12px] font-medium tabular-nums ${w.stale ? "text-rose-600" : "text-slate-500"}`}>{w.text}</span>
      </div>

      {/* who + context */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-[12px] text-slate-500"><Avatar photo={a.requester.photo} name={a.requester.name} size={22} /><span className="text-slate-700">{a.requester.name}</span> · {whenLabel(a.arrivedAt)}</span>
        {a.asset && <AssetChip label={a.asset.label} type={a.asset.type} onClick={onAsset} />}
      </div>
      {a.kind === "extension" && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
          <p className="text-[12px] text-slate-600"><span className="tabular-nums text-slate-500">{fmtDate(a.oldDate!)}</span> → <span className="font-semibold tabular-nums text-slate-800">{fmtDate(a.newDate!)}</span></p>
          <p className="mt-1 text-[12px] text-slate-500">“{a.reason}”</p>
        </div>
      )}
      {a.kind === "ticket" && a.severity && <p className="mt-2.5 text-[12px] text-slate-500">{a.severity}</p>}

      {/* actions */}
      {!rejecting ? (
        <div className="mt-3.5 flex gap-2 border-t border-slate-200 pt-3.5" onClick={stop}>
          <button onClick={onApprove} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[13px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/25">✓ Approve</button>
          <button onClick={onStartReject} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-600">✗ Reject</button>
        </div>
      ) : (
        <div className="mt-3.5 space-y-2 border-t border-slate-200 pt-3.5" onClick={stop}>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason for rejection (required)…" className="input resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={onCancelReject} className="btn-ghost text-[12px]">Cancel</button>
            <button onClick={onConfirmReject} disabled={!reason.trim()} className="btn-danger text-[12px]">Confirm reject</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- modal ---------- */
function ApprovalModal({ a, onClose, onApprove, onReject }: { a: Approval; onClose: () => void; onApprove: () => void; onReject: () => void }) {
  const w = waitLabel(a.arrivedAt);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] animate-scale-in overflow-y-auto border-l border-slate-200 bg-canvas-raised p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {a.kind === "ticket" && <span className="chip bg-fuchsia-100 text-fuchsia-700">Ticket</span>}
              <span className={`chip ${w.stale ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{w.text}</span>
            </div>
            <h3 className="mt-2.5 text-[17px] font-semibold tracking-tight text-slate-900">{a.title}</h3>
            <p className="mt-1"><ClientTag client={a.client} /></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
        </div>

        {a.kind === "stage" && <div className="mt-5"><p className="mb-2 text-[12px] font-medium text-slate-500">Stage transition</p><StageArrow from={a.stage} to={a.nextStage} /></div>}
        {a.kind === "extension" && (
          <div className="mt-5 rounded-xl bg-slate-50 px-3.5 py-3">
            <p className="text-[13px] text-slate-700"><span className="tabular-nums text-slate-500">{fmtDate(a.oldDate!)}</span> → <span className="font-semibold tabular-nums">{fmtDate(a.newDate!)}</span></p>
            <p className="mt-1.5 text-[12px] text-slate-500">“{a.reason}”</p>
          </div>
        )}
        {a.asset && <div className="mt-5"><p className="mb-2 text-[12px] font-medium text-slate-500">Attached</p><AssetChip label={a.asset.label} type={a.asset.type} onClick={() => {}} /></div>}
        {a.kind === "ticket" && a.severity && <p className="mt-5 text-[13px] text-slate-600">{a.severity}</p>}

        <dl className="mt-6 space-y-3 text-[13px]">
          {a.vertical && <div className="flex items-center justify-between border-b border-slate-200 pb-3"><dt className="text-slate-500">Vertical</dt><dd className="font-medium text-slate-800">{a.vertical}</dd></div>}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3"><dt className="text-slate-500">Requested by</dt><dd className="flex items-center gap-2 font-medium text-slate-800"><Avatar photo={a.requester.photo} name={a.requester.name} size={22} />{a.requester.name}</dd></div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3"><dt className="text-slate-500">Arrived</dt><dd className="font-medium text-slate-800">{whenLabel(a.arrivedAt)}</dd></div>
        </dl>

        <div className="mt-6 flex gap-2">
          <button onClick={onApprove} className="btn-primary flex-1">✓ Approve</button>
          <button onClick={onReject} className="btn-ghost">✗ Reject</button>
        </div>
      </aside>
    </>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
      <p className="text-[15px] font-medium text-slate-700">{title}</p>
      <p className="max-w-xs text-[13px] text-slate-500">{hint}</p>
    </div>
  );
}
