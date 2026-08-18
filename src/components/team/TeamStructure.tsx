/* @ts-nocheck */
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import {
  ACCENT, DEFAULT_ROLES, allClients, allCampaigns, allRoles,
  orderedGroups, personPlacements, projectPeopleIds, roleAccent, seedOrg,
  type Client, type Org, type Person, type Campaign,
} from "@/lib/teamData";

/* ---------- ids, slugs & routing ---------- */
const gid = (projId: string, role: string) => `g:${projId}:${role}`;
function personSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}
function allEntityIds(o: Org): Set<string> {
  const s = new Set<string>();
  for (const d of o.divisions) { s.add(d.id); for (const c of d.clients) { s.add(c.id); for (const p of c.projects) s.add(p.id); } }
  return s;
}
// "Spring Campaign" -> "spring-campaign", with -2/-3 suffix on collision.
function uniqueSlug(name: string, o: Org) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
  const ids = allEntityIds(o);
  if (!ids.has(base)) return base;
  let i = 2; while (ids.has(`${base}-${i}`)) i++; return `${base}-${i}`;
}

type Route =
  | { level: "overview" }
  | { level: "division"; divisionId: string }
  | { level: "client"; clientId: string }
  | { level: "campaign"; clientId: string; campaignId: string };

function parseHash(): Route {
  if (typeof window === "undefined") return { level: "overview" };
  const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "division" && parts[1]) return { level: "division", divisionId: parts[1] };
  if (parts[0] === "client" && parts[1]) {
    if (parts[2] === "campaign" && parts[3]) return { level: "campaign", clientId: parts[1], campaignId: parts[3] };
    return { level: "client", clientId: parts[1] };
  }
  return { level: "overview" };
}

const AVA_BG = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];
function avaColor(id: string) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVA_BG[h % AVA_BG.length]; }
function inits(name: string) { return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

/* ---------- avatar with graceful photo fallback ---------- */
function Photo({ person, size = 56, ring }: { person: Person; size?: number; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const common = { style: { width: size, height: size }, className: `rounded-full object-cover ring-4 ${ring ?? "ring-white"}` };
  if (failed)
    return (
      <div {...common} className={`${common.className} flex items-center justify-center font-semibold text-white`}
        style={{ ...common.style, backgroundColor: avaColor(person.id), fontSize: size * 0.34 }}>{inits(person.name)}</div>
    );
  return <img {...common} src={`https://i.pravatar.cc/160?img=${person.photo}`} alt={person.name} onError={() => setFailed(true)} />;
}
function MiniAvatars({ people }: { people: Person[] }) {
  const shown = people.slice(0, 5); const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => <span key={p.id} style={{ marginLeft: i ? -8 : 0 }}><Photo person={p} size={26} ring="ring-white" /></span>)}
      {extra > 0 && <span style={{ marginLeft: -8 }} className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold text-slate-600 ring-4 ring-white">+{extra}</span>}
    </div>
  );
}

/* ---------- small UI atoms ---------- */
function Toggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label={open ? "Collapse" : "Expand"}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}><polyline points="9 6 15 12 9 18" /></svg>
    </button>
  );
}
function CountBadge({ n }: { n: number }) {
  return <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-medium tabular-nums text-slate-600">{n}</span>;
}
function AddBtn({ onClick, label = "Add person" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      {label}
    </button>
  );
}

/* ================================================================= */
type ModalState =
  | { type: "add"; campaignId?: string; role?: string; divisionId?: string }
  | { type: "edit"; personId: string }
  | { type: "reassign"; personId: string; from: { campaignId: string; role: string } }
  | { type: "remove"; personId: string; campaignId: string; role: string; projectName: string }
  | { type: "addProject"; clientId?: string }
  | { type: "addClient"; divisionId: string }
  | { type: "editProject"; campaignId: string }
  | { type: "editClient"; clientId: string }
  | null;

export default function TeamStructure() {
  const [org, setOrg] = useState<Org>(() => seedOrg());
  const [route, setRoute] = useState<Route>({ level: "overview" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  /* ---------- hash routing ---------- */
  useEffect(() => {
    const sync = () => setRoute(parseHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const navigate = (hash: string, keepHighlight = false) => {
    if (!keepHighlight) setHighlight(null);
    setMenuFor(null); setSearchOpen(false);
    if (window.location.hash === hash) setRoute(parseHash());
    else window.location.hash = hash;
  };
  const goOverview = () => navigate("#/");
  const goDivision = (id: string) => navigate(`#/division/${id}`);
  const goClient = (id: string) => navigate(`#/client/${id}`);
  const goCampaign = (clientId: string, campaignId: string) => navigate(`#/client/${clientId}/project/${campaignId}`);
  const goProject = (clientId: string, projectId: string) => navigate(`#/client/${clientId}/project/${projectId}`);

  /* ---------- lookups ---------- */
  const roles = useMemo(() => allRoles(), []);
  const projectsFlat = useMemo(() => allCampaigns(), []);
  const isOpen = (id: string) => expanded.has(id);
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  function findClient(o: Org, clientId: string) { for (const d of o.divisions) { const c = d.clients.find((x: Client) => x.id === clientId); if (c) return { d, c }; } return null; }
  function findProject(o: Org, campaignId: string) { for (const d of o.divisions) for (const c of d.clients) { const p = c.projects.find((x: Campaign) => x.id === campaignId); if (p) return { d, c, p }; } return null; }
  const shownCampaigns = (c: Client) => c.projects.filter((p: Campaign) => !p.archived || showArchived);
  const clientPeopleIds = (c: Client) => Array.from(new Set(shownCampaigns(c).flatMap(projectPeopleIds)));
  const divisionClients = (d: Org["divisions"][number]) => d.clients.filter((c: Client) => !c.archived || showArchived);
  const divisionStats = (d: Org["divisions"][number]) => {
    const cs = divisionClients(d); const projs = cs.flatMap(shownCampaigns);
    return { clients: cs.length, projects: projs.length, people: new Set(projs.flatMap(projectPeopleIds)).size };
  };
  const archivedCount = org.divisions.reduce((n: number, d: Org["divisions"][number]) => n + d.clients.filter((c: Client) => c.archived).length + d.clients.reduce((m: number, c: Client) => m + c.projects.filter((p: Campaign) => p.archived).length, 0), 0);

  const curDivision = route.level === "division" ? org.divisions.find((d: Org["divisions"][number]) => d.id === route.divisionId) : undefined;
  const curClient = route.level === "client" || route.level === "campaign" ? findClient(org, route.clientId) : null;
  const curCampaign = route.level === "campaign" ? findProject(org, route.campaignId) : null;

  /* ---------- centre the org tree + apply the collapse rule per page ---------- */
  const scrollRef = useRef<HTMLDivElement>(null);
  const recentre = () => { const el = scrollRef.current; if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; };
  // Re-centre on route/data changes AND after expansion reshapes the tree, so
  // the root stays in view when the client-page auto-expand widens it.
  useLayoutEffect(() => { const id = requestAnimationFrame(recentre); return () => cancelAnimationFrame(id); }, [route, org, showArchived, expanded]);
  // Bring a search-highlighted person into view once their page has rendered.
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => document.querySelector('[data-hl="1"]')?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }), 320);
    return () => clearTimeout(t);
  }, [highlight, route]);
  useEffect(() => {
    // Client page: project branches default EXPANDED when a client has <= 2 projects.
    if (route.level === "client") {
      const f = findClient(org, route.clientId);
      if (f) { const projs = shownCampaigns(f.c); if (projs.length <= 2) setExpanded((s) => { const n = new Set(s); projs.forEach((p) => { n.add(`p:${p.id}`); (orderedGroups(p) as any[]).forEach((g: any) => n.add(gid(p.id, g.role))); }); return n; }); }
    }
  }, [route, showArchived, org]);

  /* ---------- mutations (central store) ---------- */
  function mutate(fn: (o: Org) => void) { setOrg((prev: Org) => { const n = structuredClone(prev); fn(n); return n; }); }
  function addPlacement(o: Org, personId: string, campaignId: string, role: string) {
    for (const d of o.divisions) for (const c of d.clients) for (const p of c.projects) if (p.id === campaignId) {
      let grp = p.groups.find((x: any) => x.role === role);
      if (!grp) { grp = { role, personIds: [] }; p.groups.push(grp); }
      if (!grp.personIds.includes(personId)) grp.personIds.push(personId);
    }
    setExpanded((s) => new Set(s).add(gid(campaignId, role)).add(`p:${campaignId}`));
  }
  function removePlacement(o: Org, personId: string, campaignId: string, role: string) {
    for (const d of o.divisions) for (const c of d.clients) for (const p of c.projects) if (p.id === campaignId) {
      const grp = p.groups.find((x: any) => x.role === role);
      if (grp) grp.personIds = grp.personIds.filter((id: any) => id !== personId);
      p.groups = p.groups.filter((x: any) => x.personIds.length > 0 || DEFAULT_ROLES.includes(x.role));
    }
  }
  function addClient(divisionId: string, name: string, kind: Client["kind"]) {
    const id = uniqueSlug(name, org);
    mutate((o: any) => { o.divisions.find((d: any) => d.id === divisionId)?.clients.push({ id, name, kind, projects: [] }); });
    goClient(id); // navigate straight to the new client's page
  }
  function addProject(clientId: string, name: string, type: string, team: { personId: string; role: string }[]) {
    const id = uniqueSlug(name, org);
    mutate((o) => { const f = findClient(o, clientId); if (!f) return; f.c.projects.push({ id, name, type, groups: DEFAULT_ROLES.map((role) => ({ role, personIds: [] })) }); team.forEach((t) => addPlacement(o, t.personId, id, t.role)); });
    setExpanded((s) => { const n = new Set(s).add(`c:${clientId}`).add(`p:${id}`); DEFAULT_ROLES.forEach((r) => n.add(gid(id, r))); return n; });
    goProject(clientId, id); // navigate straight to the new project tree page
  }

  /* ---------- global search ---------- */
  const results = useMemo(() => {
    const t = search.trim().toLowerCase(); if (!t) return null;
    // @ts-ignore
    const people = Object.values(org.people).filter((p: any) => p.name.toLowerCase().includes(t) || p.title.toLowerCase().includes(t)).slice(0, 6);
    const clients: { c: Client; dName: string }[] = []; const projects: { p: Campaign; cId: string; label: string }[] = [];
    for (const d of org.divisions) for (const c of d.clients) {
      if (c.name.toLowerCase().includes(t)) clients.push({ c, dName: d.name });
      for (const p of c.projects) if (p.name.toLowerCase().includes(t)) projects.push({ p, cId: c.id, label: `${c.name} · ${d.name}` });
    }
    return { people, clients: clients.slice(0, 5), projects: projects.slice(0, 5) };
  }, [search, org]);
  function personFirstPlacement(personId: string) {
    for (const d of org.divisions) for (const c of d.clients) for (const p of c.projects) if (p.groups.some((g: any) => g.personIds.includes(personId))) return { clientId: c.id, campaignId: p.id };
    return null;
  }
  function goToPerson(personId: string) {
    const pl = personFirstPlacement(personId);
    setHighlight(personId); setSearch(""); setSearchOpen(false);
    if (pl) navigate(`#/client/${pl.clientId}/project/${pl.campaignId}`, true);
  }

  /* ================= reusable tree nodes ================= */
  function MenuBtn({ k }: { k: string }) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === k ? null : k); }} aria-label="More options" className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
      </button>
    );
  }
  function MenuPanel({ k, archived, onEdit, onArchive }: { k: string; archived: boolean; onEdit: () => void; onArchive: () => void }) {
    if (menuFor !== k) return null;
    return (
      <div className="absolute right-2 top-11 z-30 w-36 overflow-hidden rounded-xl border border-slate-200 bg-canvas-raised py-1 shadow-lift">
        <button onClick={(e) => { e.stopPropagation(); setMenuFor(null); onEdit(); }} className="block w-full px-3.5 py-1.5 text-left text-[12.5px] text-slate-700 transition-colors hover:bg-slate-100">Edit</button>
        <button onClick={(e) => { e.stopPropagation(); setMenuFor(null); onArchive(); }} className="block w-full px-3.5 py-1.5 text-left text-[12.5px] text-slate-600 transition-colors hover:bg-slate-100">{archived ? "Restore" : "Archive"}</button>
      </div>
    );
  }
  function DashedSlot({ label, sub, w = 150, onClick }: { label: string; sub?: string; w?: number; onClick: () => void }) {
    return (
      <button onClick={onClick} style={{ width: w }} className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-slate-500 transition-colors hover:border-brand-500/50 hover:text-slate-700">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        <span className="text-[11.5px] font-medium">{label}</span>
        {sub && <span className="text-[10.5px]">{sub}</span>}
      </button>
    );
  }
  function PersonCard({ pid, campaignId, role }: { pid: string; campaignId?: string; role?: string }) {
    const person = org.people[pid]; if (!person) return null;
    const hit = highlight === pid;
    return (
      <button onClick={() => setSelected(pid)} data-hl={hit ? "1" : undefined}
        className={`card relative w-[178px] shrink-0 overflow-visible px-4 pb-3.5 pt-9 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 ${hit ? "ring-2 ring-brand-500/70 shadow-glow" : ""}`}>
        <span className="absolute -top-6 left-1/2 -translate-x-1/2"><Photo person={person} size={52} /></span>
        <span className="absolute left-2.5 top-2.5"><CountBadge n={person.tasks} /></span>
        <p className="truncate text-[13px] font-semibold text-slate-900">{person.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-slate-500">{role ?? person.title}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">{person.country} {person.flag}</p>
      </button>
    );
  }
  function RolePillNode({ campaign, role, personIds }: { campaign: Campaign; role: string; personIds: string[] }) {
    const id = gid(campaign.id, role);
    const a = ACCENT[roleAccent(role)];
    const open = isOpen(id);
    return (
      <li>
        <div className="flex flex-col items-center gap-1.5">
          <button onClick={() => toggle(id)} className={`chip ${a.pill} gap-2 px-3 py-1 text-[12px] transition-transform hover:scale-[1.03]`}>
            <span className="font-semibold tracking-tight">{role}</span>
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-900/10 px-1 text-[10px] tabular-nums">{personIds.length}</span>
          </button>
          <AddBtn label="Add" onClick={() => setModal({ type: "add", campaignId: campaign.id, role })} />
        </div>
        {open && (
          <ul>
            {personIds.length > 0
              ? personIds.map((pid) => <li key={pid}><PersonCard pid={pid} campaignId={campaign.id} role={role} /></li>)
              : <li><DashedSlot label="Add person" onClick={() => setModal({ type: "add", campaignId: campaign.id, role })} /></li>}
          </ul>
        )}
      </li>
    );
  }
  // variant: "branch" (on client page — header opens the campaign page) | "root" (the campaign page itself)
  function CampaignNode({ campaign, clientId, variant = "branch" }: { campaign: Campaign; clientId: string; variant?: "branch" | "root" }) {
    const id = `p:${campaign.id}`;
    const open = variant === "root" ? true : isOpen(id);
    // @ts-ignore
    const groups = orderedGroups(campaign);
    // @ts-ignore
    const people = projectPeopleIds(campaign).length;
    return (
      <li>
        <div className="relative">
          <div className={`card w-[220px] overflow-hidden px-4 py-3 text-left ${campaign.archived ? "opacity-60" : ""}`}>
            <span className="absolute inset-x-0 top-0 h-[3px] bg-slate-200" />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {variant === "branch"
                    ? <button onClick={() => goProject(clientId, campaign.id)} className="truncate text-[13px] font-semibold text-slate-900 transition-colors hover:text-brand-500">{campaign.name}</button>
                    : <p className="truncate text-[13px] font-semibold text-slate-900">{campaign.name}</p>}
                  {campaign.archived && <span className="chip bg-slate-100 text-slate-400 px-1.5 py-0 text-[10px]">archived</span>}
                </div>
                {/* @ts-ignore */}
                <p className="mt-0.5 text-[11px] text-slate-500">{campaign.type ? campaign.type + " · " : ""}{people} {people === 1 ? "person" : "people"}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <MenuBtn k={id} />
                {/* @ts-ignore */}
                {variant === "branch" && <Toggle open={open} onClick={() => { toggle(id); if (!open) setExpanded((s) => { const n = new Set(s); groups.forEach((g: any) => n.add(gid(campaign.id, g.role))); return n; }); }} />}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 border-t border-slate-200 pt-2">
              <AddBtn onClick={() => setModal({ type: "add", campaignId: campaign.id })} />
              {variant === "branch" && <button onClick={() => goProject(clientId, campaign.id)} className="ml-auto text-[11px] font-medium text-brand-500 hover:underline">Open →</button>}
            </div>
          </div>
          <MenuPanel k={id} archived={!!campaign.archived}
            onEdit={() => setModal({ type: "editProject", campaignId: campaign.id })}
            onArchive={() => mutate((o) => { const f = findProject(o, campaign.id); if (f) f.p.archived = !f.p.archived; })} />
        </div>
        {/* @ts-ignore */}
        {open && <ul>{groups.map((grp: any) => <RolePillNode key={grp.role} campaign={campaign} role={grp.role} personIds={grp.personIds} />)}</ul>}
      </li>
    );
  }

  /* ================= page views ================= */
  function renderOverview() {
    return (
      <div>
        <div className="mb-7">
          <h1 className="text-[28px] font-semibold leading-none tracking-tight text-slate-900">Team Structure</h1>
          <p className="mt-2.5 text-[14px] text-slate-500">Three divisions, one company. Open a division to drill in.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {org.divisions.map((d: any) => {
            const s = divisionStats(d);
            const a = (ACCENT as any)[d.accent as any];
            return (
              // @ts-ignore
              <button key={d.id} onClick={() => goDivision(d.id)} className="card-interactive relative overflow-hidden p-6 text-left">
                <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
                <div className="flex items-center gap-3">
                  <span className={`chip ${a.pill} px-2.5 py-1 text-[12px] font-semibold`}>{d.name}</span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[["Clients", s.clients], ["Pcampaigns", s.projects], ["People", s.people]].map(([l, v]) => (
                    <div key={l as string}><p className="text-[24px] font-semibold leading-none tabular-nums text-slate-900">{v}</p><p className="mt-1 text-[11px] text-slate-500">{l}</p></div>
                  ))}
                </div>
                <p className="mt-6 text-[12px] font-medium text-brand-500">Open division →</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDivision(d: Org["divisions"][number]) {
    const a = (ACCENT as any)[d.accent as any]; const s = divisionStats(d); const clients = divisionClients(d);
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className={`chip ${a.pill} px-2.5 py-1 text-[12px] font-semibold`}>{d.name}</span>
            <p className="mt-2.5 text-[13px] text-slate-500">{s.clients} clients / brands · {s.projects} projects · {s.people} people</p>
          </div>
          <button className="btn-primary" onClick={() => setModal({ type: "addClient", divisionId: d.id })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add client or brand
          </button>
        </div>
        {clients.length === 0 ? (
          <div className="flex justify-center py-8"><DashedSlot label="Add client / brand" sub="Nothing here yet" w={220} onClick={() => setModal({ type: "addClient", divisionId: d.id })} /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c: any) => {
              const ppl = clientPeopleIds(c).map((id) => org.people[id]).filter(Boolean);
              const projs = shownCampaigns(c);
              const cid = `c:${c.id}`;
              return (
                <div key={c.id} className="relative">
                  <button onClick={() => goClient(c.id)} className={`card-interactive w-full p-5 text-left ${c.archived ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-slate-900">{c.name}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`chip ${c.kind === "client" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"} px-2 py-0 text-[10px]`}>{c.kind === "client" ? "External" : c.kind === "brand" ? "Internal" : c.kind}</span>
                          {c.archived && <span className="chip bg-slate-100 text-slate-400 px-2 py-0 text-[10px]">archived</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <MiniAvatars people={ppl} />
                      <p className="text-[12px] text-slate-500">{projs.length} project{projs.length === 1 ? "" : "s"} · {ppl.length} {ppl.length === 1 ? "person" : "people"}</p>
                    </div>
                  </button>
                  <div className="absolute right-3 top-3"><MenuBtn k={cid} /></div>
                  <MenuPanel k={cid} archived={!!c.archived} onEdit={() => setModal({ type: "editClient", clientId: c.id })} onArchive={() => mutate((o) => { const f = findClient(o, c.id); if (f) f.c.archived = !f.c.archived; })} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderClient(c: Client, dv: Org["divisions"][number]) {
    const projs = shownCampaigns(c); const cid = `c:${c.id}`;
    return (
      <div>
        {c.archived && <ArchivedBanner kind="client" onRestore={() => mutate((o) => { const f = findClient(o, c.id); if (f) f.c.archived = false; })} />}
        <div ref={scrollRef} className="-mx-5 overflow-x-auto px-5 pb-6 md:-mx-10 md:px-10">
          <div className="orgtree min-w-max md:mx-auto md:w-max">
            <ul>
              <li>
                <div className="relative">
                  <div className={`card relative w-[240px] overflow-hidden px-4 py-3.5 text-left ${c.archived ? "opacity-60" : ""}`}>
                    <span className={`absolute inset-x-0 top-0 h-[3px] ${(ACCENT as any)[c.accent as any].bar}`} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[14px] font-semibold text-slate-900">{c.name}</p>
                          <span className="chip bg-slate-100 text-slate-500 px-1.5 py-0 text-[10px]">{c.kind}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{projs.length} project{projs.length === 1 ? "" : "s"} · {clientPeopleIds(c).length} people</p>
                      </div>
                      <MenuBtn k={cid} />
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2"><AddBtn label="Add project" onClick={() => setModal({ type: "addProject", clientId: c.id })} /></div>
                  </div>
                  <MenuPanel k={cid} archived={!!c.archived} onEdit={() => setModal({ type: "editClient", clientId: c.id })} onArchive={() => mutate((o) => { const f = findClient(o, c.id); if (f) f.c.archived = !f.c.archived; })} />
                </div>
                {projs.length > 0
                  ? <ul>{projs.map((p) => <CampaignNode key={p.id} campaign={p} clientId={c.id} variant="branch" />)}</ul>
                  : <ul><li><DashedSlot label="Add project" sub="No projects yet" w={190} onClick={() => setModal({ type: "addProject", clientId: c.id })} /></li></ul>}
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  function renderProject(p: Campaign, c: Client) {
    return (
      <div>
        {p.archived && <ArchivedBanner kind="campaign" onRestore={() => mutate((o) => { const f = findProject(o, p.id); if (f) f.p.archived = false; })} />}
        <div ref={scrollRef} className="-mx-5 overflow-x-auto px-5 pb-6 md:-mx-10 md:px-10">
          <div className="orgtree min-w-max md:mx-auto md:w-max">
            {/* CampaignNode already renders its own <li> */}
            <ul><CampaignNode campaign={p} clientId={c.id} variant="root" /></ul>
          </div>
        </div>
      </div>
    );
  }

  function ArchivedBanner({ kind, onRestore }: { kind: string; onRestore: () => void }) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-2.5">
        <p className="text-[13px] text-amber-800">This {kind} is archived — hidden from the default view.</p>
        <button onClick={onRestore} className="btn-subtle text-[12px]">Restore</button>
      </div>
    );
  }
  function NotFound({ what }: { what: string }) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <p className="text-[15px] font-medium text-slate-700">{what} not found</p>
        <p className="text-[13px] text-slate-500">It may have been renamed or removed.</p>
        <button onClick={goOverview} className="btn-primary mt-2">Back to overview</button>
      </div>
    );
  }

  /* ---------- breadcrumb ---------- */
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: BRAND.name, onClick: goOverview }];
  if (route.level === "division" && curDivision) crumbs.push({ label: curDivision.name });
  if ((route.level === "client" || route.level === "campaign") && curClient) {
    crumbs.push({ label: curClient.d.name, onClick: () => goDivision(curClient.d.id) });
    crumbs.push({ label: curClient.c.name, onClick: route.level === "campaign" ? () => goClient(curClient.c.id) : undefined });
  }
  if (route.level === "campaign" && curCampaign) crumbs.push({ label: curCampaign.p.name });

  return (
    <div className="space-y-6">
      {/* click-away layer for node menus & search */}
      {(menuFor || searchOpen) && <div className="fixed inset-0 z-20" onClick={() => { setMenuFor(null); setSearchOpen(false); }} />}

      {/* top toolbar (present on every page) */}
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-[13px]">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-600">/</span>}
              {c.onClick ? <button onClick={c.onClick} className="rounded-md px-1.5 py-0.5 font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">{c.label}</button>
                : <span className="px-1.5 py-0.5 font-medium text-slate-900">{c.label}</span>}
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Global search */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Search people, clients, projects…" className="input w-64 pl-9" />
            {searchOpen && results && (results.people.length + results.clients.length + results.projects.length > 0) && (
              <div className="absolute right-0 top-11 z-40 max-h-[60vh] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-canvas-raised p-1.5 shadow-lift">
                {results.people.length > 0 && <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">People</p>}
                {results.people.map((p: any) => (
                  <button key={p.id} onClick={() => goToPerson(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-slate-100">
                    <Photo person={p} size={26} ring="ring-transparent" /><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-slate-800">{p.name}</span><span className="block truncate text-[11px] text-slate-500">{p.title}</span></span>
                  </button>
                ))}
                {results.clients.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Clients / brands</p>}
                {results.clients.map(({ c, dName }) => (
                  <button key={c.id} onClick={() => goClient(c.id)} className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-800 transition-colors hover:bg-slate-100">{c.name} <span className="text-slate-500">· {dName}</span></button>
                ))}
                {results.projects.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Campaigns</p>}
                {results.projects.map(({ p, cId, label }) => (
                  <button key={p.id} onClick={() => goProject(cId, p.id)} className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-800 transition-colors hover:bg-slate-100">{p.name} <span className="text-slate-500">· {label}</span></button>
                ))}
              </div>
            )}
          </div>

          {/* Show archived toggle */}
          <button onClick={() => setShowArchived((v) => !v)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium tracking-tight transition-colors ${showArchived ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
            <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${showArchived ? "bg-brand-500" : "bg-slate-200"}`}><span className={`h-3 w-3 rounded-full bg-white transition-transform ${showArchived ? "translate-x-3" : ""}`} /></span>
            Show archived{archivedCount > 0 ? ` (${archivedCount})` : ""}
          </button>

          <button className="btn-primary" onClick={() => setModal({ type: "add" })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add person
          </button>
        </div>
      </div>

      {/* page content */}
      {route.level === "overview" && renderOverview()}
      {route.level === "division" && (curDivision ? renderDivision(curDivision) : <NotFound what="Division" />)}
      {route.level === "client" && (curClient ? renderClient(curClient.c, curClient.d) : <NotFound what="Client" />)}
      {route.level === "campaign" && (curCampaign ? renderProject(curCampaign.p, curCampaign.c) : <NotFound what="Pcampaign" />)}

      {/* Detail panel */}
      {selected && org.people[selected] && (
        <PersonPanel person={org.people[selected]} org={org} onClose={() => setSelected(null)}
          onEdit={() => setModal({ type: "edit", personId: selected })}
          onReassign={(from) => setModal({ type: "reassign", personId: selected, from })}
          onRemove={(campaignId, role, projectName) => setModal({ type: "remove", personId: selected, campaignId, role, projectName })}
          onOpenCampaign={(clientId, campaignId) => { setSelected(null); goProject(clientId, campaignId); }} />
      )}

      {/* Modals */}
      {modal?.type === "add" && (
        <AddPersonModal org={org} projects={projectsFlat} roles={roles} ctx={modal} onClose={() => setModal(null)}
          onSave={(p, targets) => { mutate((o) => { o.people[p.id] = p; targets.forEach((t) => addPlacement(o, p.id, t.campaignId, t.role)); }); setModal(null); setHighlight(p.id); setSelected(p.id); }} />
      )}
      {modal?.type === "edit" && org.people[modal.personId] && (
        <EditPersonModal person={org.people[modal.personId]} onClose={() => setModal(null)}
          onSave={(patch) => { const pid = modal.personId; mutate((o) => { Object.assign(o.people[pid], patch); }); setModal(null); }} />
      )}
      {modal?.type === "reassign" && (
        <ReassignModal org={org} projects={projectsFlat} roles={roles} from={modal.from} personName={org.people[modal.personId]?.name ?? ""} onClose={() => setModal(null)}
          onSave={(target, move) => { const m = modal; mutate((o) => { if (move) removePlacement(o, m.personId, m.from.campaignId, m.from.role); addPlacement(o, m.personId, target.campaignId, target.role); }); setModal(null); }} />
      )}
      {modal?.type === "remove" && (
        <ConfirmModal title="Remove from project"
          body={<>Remove <b className="text-slate-800">{org.people[modal.personId]?.name}</b> from <b className="text-slate-800">{modal.projectName}</b>? Their profile stays in other projects.</>}
          confirmLabel="Remove" onCancel={() => setModal(null)}
          onConfirm={() => { const m = modal; mutate((o) => removePlacement(o, m.personId, m.campaignId, m.role)); setModal(null); }} />
      )}
      {modal?.type === "addClient" && (
        <AddClientModal divisionName={org.divisions.find((d: any) => d.id === modal.divisionId)?.name ?? ""} onClose={() => setModal(null)}
          onSave={(name, kind) => { addClient(modal.divisionId, name, kind); setModal(null); }} />
      )}
      {modal?.type === "addProject" && (
        <AddProjectModal org={org} clients={allClients()} roles={roles} defaultClientId={modal.clientId} onClose={() => setModal(null)}
          onSave={(clientId, name, type, team) => { addProject(clientId, name, type, team); setModal(null); }} />
      )}
      {modal?.type === "editProject" && findProject(org, modal.campaignId) && (
        <EditProjectModal campaign={findProject(org, modal.campaignId)!.p} onClose={() => setModal(null)}
          onSave={(patch) => { const pid = modal.campaignId; mutate((o) => { const f = findProject(o, pid); if (f) Object.assign(f.p, patch); }); setModal(null); }} />
      )}
      {modal?.type === "editClient" && findClient(org, modal.clientId) && (
        <EditClientModal client={findClient(org, modal.clientId)!.c} onClose={() => setModal(null)}
          onSave={(patch) => { const cid = modal.clientId; mutate((o) => { const f = findClient(o, cid); if (f) Object.assign(f.c, patch); }); setModal(null); }} />
      )}
    </div>
  );
}

/* ================================================================= */
function PersonPanel({ person, org, onClose, onEdit, onReassign, onRemove, onOpenCampaign }: {
  person: Person; org: Org; onClose: () => void; onEdit: () => void;
  onReassign: (from: { campaignId: string; role: string }) => void;
  onRemove: (campaignId: string, role: string, projectName: string) => void;
  onOpenCampaign: (clientId: string, campaignId: string) => void;
}) {
  const places = personPlacements();
  const projByName = new Map(allCampaigns().map((p: any) => [p.name, p.id]));
  const clientByProjectName = new Map<string, string>();
  for (const d of org.divisions) for (const c of d.clients) for (const p of c.projects) clientByProjectName.set(p.name, c.id);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] animate-scale-in overflow-y-auto border-l border-slate-200 bg-canvas-raised p-6 shadow-lift">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <Photo person={person} size={64} ring="ring-white" />
            <div>
              <p className="text-[17px] font-semibold tracking-tight text-slate-900">{person.name}</p>
              <p className="text-[13px] text-slate-500">{person.title}</p>
              {person.department && <p className="mt-0.5 text-[12px] text-slate-500">{person.department}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="card px-4 py-3"><p className="text-[11px] text-slate-500">Campaigns</p><p className="mt-1 text-[22px] font-semibold tabular-nums text-slate-900">{places.length}</p></div>
          <div className="card px-4 py-3"><p className="text-[11px] text-slate-500">Open tasks</p><p className="mt-1 text-[22px] font-semibold tabular-nums text-slate-900">{person.tasksAssigned}</p></div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-800">Placements</p>
          <button onClick={onEdit} className="btn-subtle text-[12px]">Edit profile</button>
        </div>
        <div className="mt-2 space-y-2">
          {places.length === 0 && <p className="text-[13px] text-slate-500">Not assigned to any project.</p>}
          {places.map((pl: any, i) => {
            const campaignId = projByName.get(pl.project)!; const clientId = clientByProjectName.get(pl.project)!;
            const a = ACCENT[roleAccent(pl.role)];
            return (
              <div key={i} className="card px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => onOpenCampaign(clientId, campaignId)} className="min-w-0 text-left">
                    <p className="truncate text-[13px] font-medium text-slate-800 hover:text-brand-500">{pl.campaign}</p>
                    <p className="truncate text-[11px] text-slate-500">{pl.division} · {pl.client}</p>
                  </button>
                  <span className={`chip ${a.pill}`}>{pl.role}</span>
                </div>
                <div className="mt-2 flex gap-2 border-t border-slate-200 pt-2">
                  <button onClick={() => onReassign({ campaignId, role: pl.role })} className="text-[12px] text-slate-500 hover:text-brand-500">Reassign</button>
                  <button onClick={() => onRemove(campaignId, pl.role, pl.project)} className="text-[12px] text-slate-500 hover:text-rose-600">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

/* ---------- Modal shell ---------- */
function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[2px] animate-page" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(94vw,460px)] -translate-x-1/2 -translate-y-1/2 animate-scale-in">
        <div className="card max-h-[85vh] overflow-y-auto bg-canvas-raised p-6 shadow-lift">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[16px] font-semibold tracking-tight text-slate-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function PhotoPicker({ value, onFile, name }: { value: string | null; onFile: (url: string) => void; name: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-white">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <span className="text-[12px] font-semibold text-slate-500">{name ? inits(name) : "?"}</span>}
      </span>
      <span className="btn-subtle text-[12px]">Upload photo</span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(URL.createObjectURL(f)); }} />
    </label>
  );
}

function RoleSelect({ roles, value, onChange, placeholder = "Select role", createLabel = "New name" }: { roles: string[]; value: string; onChange: (v: string) => void; placeholder?: string; createLabel?: string }) {
  const [creating, setCreating] = useState(false);
  if (creating)
    return (
      <div className="flex gap-2">
        <input autoFocus className="input" placeholder={createLabel} value={value} onChange={(e) => onChange(e.target.value)} />
        <button className="btn-subtle" onClick={() => setCreating(false)}>Pick</button>
      </div>
    );
  return (
    <div className="flex gap-2">
      <select className="input" value={roles.includes(value) ? value : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{placeholder}</option>
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button className="btn-subtle whitespace-nowrap" onClick={() => { setCreating(true); onChange(""); }}>+ New</button>
    </div>
  );
}

function AddPersonModal({ org, projects, roles, ctx, onClose, onSave }: {
  org: Org; projects: ReturnType<typeof allCampaigns>; roles: string[];
  ctx: { campaignId?: string; role?: string; divisionId?: string };
  onClose: () => void; onSave: (p: Person, targets: { campaignId: string; role: string }[]) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ctx.role ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [country, setCountry] = useState("India");
  const scoped = ctx.divisionId ? projects.filter((p: any) => p.divisionId === ctx.divisionId) : projects;
  const [sel, setSel] = useState<Set<string>>(new Set(ctx.campaignId ? [ctx.campaignId] : []));
  const valid = name.trim() && role.trim() && sel.size > 0;
  function save() {
    const p: Person = { id: personSlug(name), name: name.trim(), title: role.trim(), photo: Math.floor(Math.random() * 70), skills: [], tasksAssigned: 0 };
    onSave(p, Array.from(sel).map((campaignId) => ({ campaignId, role: role.trim() })));
  }
  return (
    <ModalShell title="Add person" onClose={onClose}>
      <div className="space-y-4">
        <PhotoPicker value={photo} onFile={setPhoto} name={name} />
        <div><label className="label">Name</label><input className="input" placeholder="e.g. Aarav Sharma" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Role</label><RoleSelect roles={roles} value={role} onChange={setRole} /></div>
        <div><label className="label">Country</label>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>{Object.keys(FLAGS).map((c) => <option key={c} value={c}>{c} {FLAGS[c]}</option>)}</select>
        </div>
        <div>
          <label className="label">Assign to projects</label>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
            {scoped.map((p: any) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100">
                <input type="checkbox" className="accent-brand-500" checked={sel.has(p.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} />
                <span className="truncate">{p.name} <span className="text-slate-500">· {p.clientName}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={save}>Add person</button>
        </div>
      </div>
    </ModalShell>
  );
}

function EditPersonModal({ person, onClose, onSave }: { person: Person; onClose: () => void; onSave: (patch: Partial<Person>) => void }) {
  const [name, setName] = useState(person.name);
  const [title, setTitle] = useState(person.title);
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <ModalShell title="Edit profile" onClose={onClose}>
      <div className="space-y-4">
        <PhotoPicker value={photo} onFile={setPhoto} name={name} />
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Role / title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), title: title.trim() })}>Save</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReassignModal({ projects, roles, from, personName, onClose, onSave }: {
  org: Org; projects: ReturnType<typeof allCampaigns>; roles: string[];
  from: { campaignId: string; role: string }; personName: string;
  onClose: () => void; onSave: (target: { campaignId: string; role: string }, move: boolean) => void;
}) {
  const [campaignId, setCampaignId] = useState("");
  const [role, setRole] = useState(from.role);
  const [move, setMove] = useState(true);
  return (
    <ModalShell title="Reassign" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[13px] text-slate-500">Move <b className="text-slate-800">{personName}</b> to another project.</p>
        <div><label className="label">Target project</label>
          <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="" disabled>Select project</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.clientName}</option>)}
          </select>
        </div>
        <div><label className="label">Role</label><RoleSelect roles={roles} value={role} onChange={setRole} /></div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700">
          <input type="checkbox" className="accent-brand-500" checked={move} onChange={(e) => setMove(e.target.checked)} />
          Remove from current project (move instead of copy)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!campaignId || !role.trim()} onClick={() => onSave({ campaignId, role: role.trim() }, move)}>Reassign</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: React.ReactNode; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title={title} onClose={onCancel}>
      <p className="text-[13px] leading-relaxed text-slate-600">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </ModalShell>
  );
}

/* ---------- Add client / brand ---------- */
const CLIENT_KINDS: { value: Client["kind"]; label: string }[] = [
  { value: "client", label: "External client" },
  { value: "brand", label: "Internal brand" },
  { value: "product", label: "Product" },
  { value: "program", label: "Program" },
];
function AddClientModal({ divisionName, onClose, onSave }: { divisionName: string; onClose: () => void; onSave: (name: string, kind: Client["kind"]) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Client["kind"]>("client");
  return (
    <ModalShell title="Add client / brand" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[13px] text-slate-500">Adding to <b className="text-slate-800">{divisionName}</b>. Internal brands and products are added exactly like external clients.</p>
        <div><label className="label">Name</label><input autoFocus className="input" placeholder="e.g. Northwind Studio" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Client["kind"])}>
            {CLIENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), kind)}>Add</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Add project ---------- */
const PROJECT_TYPES = ["Retainer", "Campaign", "Launch", "Website", "Content", "Product", "Internal"];
function AddProjectModal({ org, clients, roles, defaultClientId, onClose, onSave }: {
  org: Org; clients: ReturnType<typeof allClients>; roles: string[]; defaultClientId?: string;
  onClose: () => void; onSave: (clientId: string, name: string, type: string, team: { personId: string; role: string }[]) => void;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [type, setType] = useState("");
  const [team, setTeam] = useState<{ personId: string; role: string }[]>([]);
  const people = Object.values(org.people);
  const valid = name.trim() && clientId;
  const roleOptions = Array.from(new Set([...DEFAULT_ROLES, ...roles]));
  return (
    <ModalShell title="Add project" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Campaign name</label><input autoFocus className="input" placeholder="e.g. Spring Campaign" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Belongs to</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="" disabled>Select client / brand</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.division}</option>)}
          </select>
        </div>
        <div><label className="label">Campaign type</label><RoleSelect roles={PROJECT_TYPES} value={type} onChange={setType} placeholder="Select type" createLabel="New type" /></div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">Initial team <span className="text-slate-400">(optional)</span></label>
            <button className="btn-subtle text-[12px]" onClick={() => setTeam((t) => [...t, { personId: "", role: "" }])}>+ Add teammate</button>
          </div>
          {team.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-center text-[12px] text-slate-500">Starts with empty role slots — add people now or later.</p>
          ) : (
            <div className="space-y-2">
              {team.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input" value={row.personId} onChange={(e) => setTeam((t) => t.map((r, j) => j === i ? { ...r, personId: e.target.value } : r))}>
                    <option value="" disabled>Person</option>
                    {people.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select className="input w-auto" value={row.role} onChange={(e) => setTeam((t) => t.map((r, j) => j === i ? { ...r, role: e.target.value } : r))}>
                    <option value="" disabled>Role</option>
                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => setTeam((t) => t.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600" aria-label="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={() => onSave(clientId, name.trim(), type.trim(), team.filter((r) => r.personId && r.role))}>Add project</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------- Edit project / client ---------- */
function EditProjectModal({ campaign, onClose, onSave }: { campaign: Campaign; onClose: () => void; onSave: (patch: Partial<Campaign>) => void }) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState(campaign.type ?? "");
  return (
    <ModalShell title="Edit project" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Campaign name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Campaign type</label><RoleSelect roles={PROJECT_TYPES} value={type} onChange={setType} placeholder="Select type" createLabel="New type" /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), type: type.trim() || undefined })}>Save</button>
        </div>
      </div>
    </ModalShell>
  );
}
function EditClientModal({ client, onClose, onSave }: { client: Client; onClose: () => void; onSave: (patch: Partial<Client>) => void }) {
  const [name, setName] = useState(client.name);
  const [kind, setKind] = useState<Client["kind"]>(client.kind);
  return (
    <ModalShell title="Edit client / brand" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Client["kind"])}>
            {CLIENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), kind })}>Save</button>
        </div>
      </div>
    </ModalShell>
  );
}

const FLAGS: Record<string, string> = {
  India: "🇮🇳", "United Arab Emirates": "🇦🇪", Singapore: "🇸🇬", "United Kingdom": "🇬🇧",
  "United States": "🇺🇸", Canada: "🇨🇦", Australia: "🇦🇺", Germany: "🇩🇪",
};
