// Team Structure — shared team model for Aikyaa.
// One team works across multiple independent businesses.
// Team members have skills, departments, and are assigned to tasks/campaigns/businesses.

export type AccentKey = "orange" | "violet" | "emerald" | "sky" | "indigo" | "amber" | "fuchsia" | "brand";

export type TeamMember = {
  id: string;
  name: string;
  title: string;
  department?: string;
  skills: string[];
  photo: number; // pravatar index
  tasksAssigned: number;
};

export type Department = {
  id: string;
  name: string;
  accent: AccentKey;
  members: TeamMember[];
};

export type Team = {
  members: Record<string, TeamMember>;
  departments: Department[];
};

// Default skills available across the team
export const DEFAULT_SKILLS = [
  "Pcampaign Management",
  "Communication",
  "Strategy",
  "Design",
  "Front-End Development",
  "Back-End Development",
  "Content Writing",
  "Marketing",
  "UX Research",
  "Quality Assurance",
];

// Default departments
export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "operations", name: "Operations", accent: "sky", members: [] },
  { id: "product", name: "Product & Design", accent: "violet", members: [] },
  { id: "engineering", name: "Engineering", accent: "emerald", members: [] },
  { id: "marketing", name: "Marketing", accent: "orange", members: [] },
];

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

export function departmentAccent(dept: Department): AccentKey {
  return dept.accent;
}

export function seedTeam(): Team {
  const members: Record<string, TeamMember> = {};
  const departments = JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS));
  return { members, departments };
}

// ---- Backward compatibility exports (for Phase 3 rebuild) ----
// These exist to maintain compatibility with TeamStructure component
// which is still using the old demo data model. Will be replaced in Phase 3.

export type Org = any;
export type Person = TeamMember;
export type Client = { id: string; name: string; kind?: string; accent?: string; projects: any[]; archived?: boolean };
export type Campaign = { id: string; name: string; type?: string; groups: any[]; archived?: boolean };

export const DEFAULT_ROLES = ["Pcampaign Manager", "Communication Manager", "Strategist", "Designer", "Editor"];

export function seedOrg() {
  return { people: {}, divisions: DEFAULT_DEPARTMENTS };
}

export function allRoles() { return DEFAULT_SKILLS; }
export function allCampaigns() { return []; }
export function allClients() { return []; }
export function projectPeopleIds() { return []; }
export function orderedGroups(p: any) { return []; }
export function roleAccent(role: string): AccentKey { return "sky"; }
export function personPlacements() { return []; }
