// Enum-like constants used across the app (schema keeps them as strings so
// SQLite dev and Postgres prod share one schema).

export const CLIENT_KINDS = ["external", "internal"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export const ROLES = ["ceo", "lead", "member", "sales", "finance"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "CEO / Head of Operations",
  lead: "Division / Brand Lead (PM)",
  member: "Team Member",
  sales: "Sales / BD",
  finance: "Finance",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TICKET_TYPES = ["change", "bug", "revision"] as const;

export const SERVICE_DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export const BRAND_DEAL_STAGES = [
  "outreach",
  "in_talks",
  "terms",
  "signed",
  "deliverables",
  "completed",
  "paid",
] as const;

export const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  outreach: "Outreach",
  in_talks: "In talks",
  terms: "Terms",
  signed: "Signed",
  deliverables: "Deliverables in progress",
  completed: "Completed",
  paid: "Paid",
};

export const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue"] as const;

export const ASSET_TYPES = ["footage", "master", "final", "doc", "image", "design", "other"] as const;

// Stale-deal detection default
export const STALE_DEAL_DAYS = 5;

// Default escalation ladder — seeded as company-scope EscalationRule
// rows; timings editable in Admin. offsetHours is relative to the due date.
export const DEFAULT_ESCALATION_LADDER = [
  { offsetHours: -24, action: "remind_assignee", level: 1 },
  { offsetHours: 0, action: "mark_overdue_notify_pm", level: 2 },
  { offsetHours: 24, action: "escalate_ceo", level: 3 },
  { offsetHours: 48, action: "schedule_review_lock", level: 4 },
] as const;

export const ESCALATION_ACTION_LABELS: Record<string, string> = {
  remind_assignee: "Remind assignee",
  mark_overdue_notify_pm: "Mark OVERDUE + notify PM",
  escalate_ceo: "Escalate to owner / ops",
  schedule_review_lock: "Schedule review + lock deadline edits",
};

// Default verticals shipped with the system. All editable in-app.
export const DEFAULT_VERTICALS: { name: string; slug: string; isSystem?: boolean; stages: string[] }[] = [
  { name: "Strategy", slug: "strategy", stages: ["Research", "Positioning", "Strategy doc", "Internal review", "Client review", "Approved"] },
  { name: "Launch strategy", slug: "launch-strategy", stages: ["Plan", "Assets mapped", "Timeline locked", "Pre-launch", "Launch live", "Post-mortem"] },
  { name: "Scripting", slug: "scripting", stages: ["Brief", "Draft", "Internal review", "Revisions", "Locked"] },
  { name: "Shoots", slug: "shoots", stages: ["Shot list", "Scheduling", "Pre-production", "Shoot day", "Footage handover"] },
  { name: "Edits", slug: "edits", stages: ["Ingest", "Rough cut", "Internal review", "Fine cut", "Color & sound", "Final export"] },
  { name: "Variations", slug: "variations", stages: ["Master approved", "Variation matrix defined", "Batch in production", "QC", "Delivered"] },
  { name: "Content", slug: "content", stages: ["Calendar", "Creation", "Review", "Scheduled", "Published"] },
  { name: "Tech / Dev", slug: "tech", stages: ["Scoped", "In development", "Code review", "QA", "Client UAT", "Deployed"] },
  { name: "Media / Performance", slug: "media", stages: ["Brief", "Setup", "Live", "Optimization", "Reporting", "Closed"] },
  { name: "Change Requests", slug: "change-requests", isSystem: true, stages: ["Raised", "Triaged", "Approved", "In progress", "Done", "Verified"] },
];

export const CHANGE_REQUEST_SLUG = "change-requests";

// Project templates. Stored in DB (editable) and seeded from here.
// Task offsets are relative to project start; negative milestone offsets would
// be relative to end date in a launch context — v1 keeps everything relative
// to start for predictability.
export interface TemplateConfig {
  verticals: string[]; // vertical slugs
  milestones: { title: string; offsetDays: number; billable: boolean; amountPct?: number }[];
  tasks: { title: string; vertical: string; offsetDays: number; estimateHours: number; priority: Priority }[];
}

export const DEFAULT_TEMPLATES: { key: string; name: string; description: string; config: TemplateConfig }[] = [
  {
    key: "course-launch",
    name: "Course Launch",
    description: "Full launch: strategy, scripts, shoots, edits, variations, media.",
    config: {
      verticals: ["strategy", "launch-strategy", "scripting", "shoots", "edits", "variations", "media", "change-requests"],
      milestones: [
        { title: "Strategy locked", offsetDays: 7, billable: true, amountPct: 20 },
        { title: "Scripts locked", offsetDays: 14, billable: false },
        { title: "All masters delivered", offsetDays: 30, billable: true, amountPct: 40 },
        { title: "Launch live", offsetDays: 42, billable: true, amountPct: 40 },
      ],
      tasks: [
        { title: "Audience & offer research", vertical: "strategy", offsetDays: 3, estimateHours: 8, priority: "high" },
        { title: "Positioning & launch narrative", vertical: "strategy", offsetDays: 6, estimateHours: 6, priority: "high" },
        { title: "Launch plan & timeline", vertical: "launch-strategy", offsetDays: 8, estimateHours: 6, priority: "high" },
        { title: "Script: hero VSL", vertical: "scripting", offsetDays: 12, estimateHours: 10, priority: "high" },
        { title: "Scripts: ad hooks batch 1", vertical: "scripting", offsetDays: 14, estimateHours: 8, priority: "medium" },
        { title: "Shoot day: hero + ads", vertical: "shoots", offsetDays: 20, estimateHours: 10, priority: "high" },
        { title: "Edit: hero VSL master", vertical: "edits", offsetDays: 26, estimateHours: 16, priority: "high" },
        { title: "Variation matrix: hero (sizes/hooks/langs)", vertical: "variations", offsetDays: 32, estimateHours: 12, priority: "medium" },
        { title: "Media plan & campaign setup", vertical: "media", offsetDays: 36, estimateHours: 8, priority: "high" },
      ],
    },
  },
  {
    key: "abm-retainer",
    name: "ABM Retainer",
    description: "Monthly retainer: strategy, content, media, change requests.",
    config: {
      verticals: ["strategy", "content", "media", "change-requests"],
      milestones: [
        { title: "Month 1 review", offsetDays: 30, billable: true, amountPct: 100 },
      ],
      tasks: [
        { title: "Account list & ICP refresh", vertical: "strategy", offsetDays: 5, estimateHours: 6, priority: "high" },
        { title: "Content calendar (month)", vertical: "content", offsetDays: 7, estimateHours: 4, priority: "medium" },
        { title: "Campaign setup & QA", vertical: "media", offsetDays: 10, estimateHours: 6, priority: "high" },
        { title: "Weekly optimization pass", vertical: "media", offsetDays: 14, estimateHours: 4, priority: "medium" },
      ],
    },
  },
  {
    key: "funnel-build",
    name: "Funnel Build",
    description: "Landing pages, tech build, content, media launch.",
    config: {
      verticals: ["strategy", "tech", "content", "media", "change-requests"],
      milestones: [
        { title: "Funnel map approved", offsetDays: 7, billable: true, amountPct: 30 },
        { title: "Build complete (UAT)", offsetDays: 21, billable: true, amountPct: 40 },
        { title: "Live + handover", offsetDays: 28, billable: true, amountPct: 30 },
      ],
      tasks: [
        { title: "Funnel map & copy brief", vertical: "strategy", offsetDays: 5, estimateHours: 8, priority: "high" },
        { title: "Landing page build", vertical: "tech", offsetDays: 14, estimateHours: 20, priority: "high" },
        { title: "Tracking & pixels QA", vertical: "tech", offsetDays: 18, estimateHours: 6, priority: "high" },
        { title: "Page copy & creatives", vertical: "content", offsetDays: 12, estimateHours: 10, priority: "medium" },
        { title: "Launch campaigns", vertical: "media", offsetDays: 24, estimateHours: 6, priority: "high" },
      ],
    },
  },
  {
    key: "tech-build",
    name: "Tech Build",
    description: "Scoped development engagement with UAT and deployment.",
    config: {
      verticals: ["tech", "change-requests"],
      milestones: [
        { title: "Scope signed off", offsetDays: 5, billable: true, amountPct: 30 },
        { title: "Feature complete", offsetDays: 25, billable: true, amountPct: 40 },
        { title: "Deployed to production", offsetDays: 35, billable: true, amountPct: 30 },
      ],
      tasks: [
        { title: "Technical scoping doc", vertical: "tech", offsetDays: 4, estimateHours: 8, priority: "high" },
        { title: "Core build sprint 1", vertical: "tech", offsetDays: 15, estimateHours: 40, priority: "high" },
        { title: "QA pass & fixes", vertical: "tech", offsetDays: 28, estimateHours: 12, priority: "medium" },
      ],
    },
  },
  {
    key: "brand-deal-fulfillment",
    name: "Brand-Deal Fulfillment",
    description: "Deliverables for a signed brand partnership (auto-used on deal Signed).",
    config: {
      verticals: ["scripting", "shoots", "edits", "content", "change-requests"],
      milestones: [
        { title: "Deliverables approved by partner", offsetDays: 21, billable: true, amountPct: 100 },
      ],
      tasks: [
        { title: "Deliverables brief & concepts", vertical: "scripting", offsetDays: 4, estimateHours: 4, priority: "high" },
        { title: "Shoot: sponsored content", vertical: "shoots", offsetDays: 10, estimateHours: 8, priority: "high" },
        { title: "Edit: sponsored deliverables", vertical: "edits", offsetDays: 16, estimateHours: 10, priority: "high" },
        { title: "Publish & report", vertical: "content", offsetDays: 20, estimateHours: 3, priority: "medium" },
      ],
    },
  },
  {
    key: "product-sprint",
    name: "Product Sprint",
    description: "Two-week internal product sprint for your own products.",
    config: {
      verticals: ["tech", "content", "change-requests"],
      milestones: [{ title: "Sprint review", offsetDays: 14, billable: false }],
      tasks: [
        { title: "Sprint planning & scope", vertical: "tech", offsetDays: 1, estimateHours: 3, priority: "high" },
        { title: "Build sprint backlog", vertical: "tech", offsetDays: 10, estimateHours: 30, priority: "high" },
        { title: "Release notes & changelog", vertical: "content", offsetDays: 13, estimateHours: 2, priority: "low" },
      ],
    },
  },
];

// Workload thresholds
export const WORKLOAD_AMBER = 0.85;
export const WORKLOAD_RED = 1.0;

export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
