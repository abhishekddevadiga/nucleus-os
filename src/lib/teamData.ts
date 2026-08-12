// Team Structure — org model + helpers.
// Client-side model: one person registry, many placements, so the same
// profile can appear across several projects and divisions.

export type AccentKey = "orange" | "violet" | "emerald" | "sky" | "indigo" | "amber" | "fuchsia" | "brand";

export type Person = {
  id: string;
  name: string;
  title: string;
  country: string;
  flag: string;
  photo: number; // pravatar index
  tasks: number;
};

export type Group = { role: string; personIds: string[] };
export type Project = { id: string; name: string; groups: Group[]; type?: string; archived?: boolean };
export type Client = { id: string; name: string; kind: "brand" | "client" | "product" | "program"; projects: Project[]; archived?: boolean };
export type Division = { id: string; name: string; accent: AccentKey; clients: Client[] };
export type Org = { people: Record<string, Person>; divisions: Division[] };

// The five role groups every new project starts with (rendered as empty slots).
export const DEFAULT_ROLES = ["Project Manager", "Communication Manager", "Strategist", "Designer", "Editor"];
// Flat client/brand index — used to populate the "belongs to" selector.
export function allClients(org: Org): { id: string; name: string; division: string; divisionId: string }[] {
  const out: { id: string; name: string; division: string; divisionId: string }[] = [];
  for (const d of org.divisions) for (const c of d.clients) out.push({ id: c.id, name: c.name, division: d.name, divisionId: d.id });
  return out;
}

// Canonical role ordering (extensible — unknown roles sort after, alphabetically).
export const ROLE_ORDER = [
  "Project Manager",
  "Communication Manager",
  "Strategist",
  "Designer",
  "Editor",
  "Front-End Developer",
  "Back-End Developer",
  "UX Researcher",
  "Content Writer",
  "Marketing Lead",
];

export const ROLE_ACCENT: Record<string, AccentKey> = {
  "Project Manager": "sky",
  "Communication Manager": "indigo",
  Strategist: "amber",
  Designer: "violet",
  Editor: "emerald",
  "Front-End Developer": "brand",
  "Back-End Developer": "emerald",
  "UX Researcher": "fuchsia",
  "Content Writer": "sky",
  "Marketing Lead": "orange",
};

export const ACCENT: Record<AccentKey, { pill: string; bar: string; ring: string; dot: string }> = {
  orange: { pill: "bg-orange-100 text-orange-700", bar: "bg-orange-700", ring: "ring-orange-700/40", dot: "bg-orange-700" },
  violet: { pill: "bg-violet-100 text-violet-700", bar: "bg-violet-700", ring: "ring-violet-700/40", dot: "bg-violet-700" },
  emerald: { pill: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-700", ring: "ring-emerald-700/40", dot: "bg-emerald-700" },
  sky: { pill: "bg-sky-100 text-sky-700", bar: "bg-sky-700", ring: "ring-sky-700/40", dot: "bg-sky-700" },
  indigo: { pill: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-700", ring: "ring-indigo-700/40", dot: "bg-indigo-700" },
  amber: { pill: "bg-amber-100 text-amber-800", bar: "bg-amber-700", ring: "ring-amber-700/40", dot: "bg-amber-700" },
  fuchsia: { pill: "bg-fuchsia-100 text-fuchsia-700", bar: "bg-fuchsia-700", ring: "ring-fuchsia-700/40", dot: "bg-fuchsia-700" },
  brand: { pill: "bg-brand-100 text-brand-700", bar: "bg-brand-500", ring: "ring-brand-500/40", dot: "bg-brand-500" },
};

export function roleAccent(role: string): AccentKey {
  return ROLE_ACCENT[role] ?? "sky";
}

export function orderedGroups(project: Project): Group[] {
  return [...project.groups]
    .filter((g) => g.personIds.length > 0 || true)
    .sort((a, b) => {
      const ia = ROLE_ORDER.indexOf(a.role);
      const ib = ROLE_ORDER.indexOf(b.role);
      if (ia === -1 && ib === -1) return a.role.localeCompare(b.role);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

export function projectPeopleIds(p: Project): string[] {
  return Array.from(new Set(p.groups.flatMap((g) => g.personIds)));
}
export function clientPeopleIds(c: Client): string[] {
  return Array.from(new Set(c.projects.flatMap(projectPeopleIds)));
}
export function divisionPeopleIds(d: Division): string[] {
  return Array.from(new Set(d.clients.flatMap(clientPeopleIds)));
}

export function personPlacements(org: Org, personId: string): { division: string; client: string; project: string; role: string }[] {
  const out: { division: string; client: string; project: string; role: string }[] = [];
  for (const d of org.divisions)
    for (const c of d.clients)
      for (const p of c.projects)
        for (const g of p.groups)
          if (g.personIds.includes(personId)) out.push({ division: d.name, client: c.name, project: p.name, role: g.role });
  return out;
}

export function allRoles(org: Org): string[] {
  const s = new Set<string>(ROLE_ORDER);
  for (const d of org.divisions) for (const c of d.clients) for (const p of c.projects) for (const g of p.groups) s.add(g.role);
  return Array.from(s);
}

export function allProjects(org: Org): { id: string; name: string; divisionId: string; clientName: string }[] {
  const out: { id: string; name: string; divisionId: string; clientName: string }[] = [];
  for (const d of org.divisions) for (const c of d.clients) for (const p of c.projects) out.push({ id: p.id, name: p.name, divisionId: d.id, clientName: c.name });
  return out;
}

// ---- Starter structure ------------------------------------------------------
// Ships empty on purpose. Add your own divisions below (or leave the three
// generic ones), then add clients, projects, and people from the Team screen.

const PEOPLE: Person[] = [];

const DIVISIONS: Division[] = [
  { id: "services", name: "Client Services", accent: "sky", clients: [] },
  { id: "products", name: "Products", accent: "violet", clients: [] },
  { id: "internal", name: "Internal", accent: "emerald", clients: [] },
];

export function seedOrg(): Org {
  const people: Record<string, Person> = {};
  for (const p of PEOPLE) people[p.id] = p;
  // deep clone divisions so state mutations don't touch the seed
  return { people, divisions: JSON.parse(JSON.stringify(DIVISIONS)) };
}
