// ============================================================================
// AIKYAA CONSTANTS
// Domain vocabulary, defaults, and reference data.
// ============================================================================

// Role model: three-tier permission structure + job function via Department/Skills.
export const ROLES = ["owner", "lead", "member"] as const;
export const ROLE_LABELS = {
  owner: "Owner",
  lead: "Lead",
  member: "Team Member",
} as const;

// Task priority levels.
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

// Ticket types (for tasks in the Change Requests workstream).
export const TICKET_TYPES = ["change", "bug", "revision"] as const;
export const TICKET_TYPE_LABELS = {
  change: "Change Request",
  bug: "Bug",
  revision: "Revision",
} as const;

// Business status lifecycle.
export const BUSINESS_STATUSES = ["planned", "active", "paused", "sunset"] as const;
export const BUSINESS_STATUS_LABELS = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  sunset: "Sunset",
} as const;

// Campaign status.
export const CAMPAIGN_STATUSES = ["planning", "active", "paused", "completed", "archived"] as const;
export const CAMPAIGN_STATUS_LABELS = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
} as const;

// Campaign types.
export const CAMPAIGN_TYPES = ["marketing", "product", "seo", "content", "event", "website", "internal", "partnership", "other"] as const;
export const CAMPAIGN_TYPE_LABELS = {
  marketing: "Marketing",
  product: "Product",
  seo: "SEO",
  content: "Content",
  event: "Event",
  website: "Website",
  internal: "Internal",
  partnership: "Partnership",
  other: "Other",
} as const;

// Campaign priority.
export const CAMPAIGN_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const CAMPAIGN_PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;

// Milestone status.
export const MILESTONE_STATUSES = ["pending", "completed"] as const;

// Notification types.
export const NOTIFICATION_TYPES = [
  "reminder",
  "overdue",
  "escalation",
  "assignment",
  "extension",
  "digest",
  "announcement",
  "meeting",
] as const;

// User availability states.
export const AVAILABILITY_STATUSES = ["available", "reduced", "on_leave"] as const;

// Task/Campaign statuses for filtering and display.
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;

// ============================================================================
// WORKSTREAMS & PIPELINE STAGES
//
// Default workstreams are per-business service lines. When a new business
// is created, the user can "bootstrap" these as starter templates.
// Not all businesses need all workstreams — this is just a reference set.
// ============================================================================

export interface WorkstreamTemplate {
  name: string;
  slug: string;
  stages: string[];
  isSystem?: boolean;
}

export const DEFAULT_WORKSTREAMS: WorkstreamTemplate[] = [
  {
    name: "Strategy",
    slug: "strategy",
    stages: ["Scoped", "In progress", "Review", "Approved"],
  },
  {
    name: "Planning",
    slug: "planning",
    stages: ["Backlog", "Planned", "Ready", "In progress", "Done"],
  },
  {
    name: "Execution",
    slug: "execution",
    stages: ["To do", "In progress", "Review", "QA", "Done"],
  },
  {
    name: "Launch",
    slug: "launch",
    stages: ["Pre-launch", "Launch", "Post-launch"],
  },
  {
    name: "Change Requests",
    slug: "change-requests",
    stages: ["Raised", "Triaged", "Approved", "In progress", "Done", "Verified"],
    isSystem: true,
  },
];

export const CHANGE_REQUEST_SLUG = "change-requests";

// ============================================================================
// WORKLOAD THRESHOLDS
//
// Capacity management: when does a team member become overloaded?
// ============================================================================

export const WORKLOAD_AMBER = 0.85; // 85% of capacity = amber (warning)
export const WORKLOAD_RED = 1.0;   // 100% of capacity = red (overloaded)

// Task priority sort order.
export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ============================================================================
// DEFAULT ESCALATION LADDER
//
// When a task's deadline passes, what actions fire at what intervals?
// ============================================================================

export interface EscalationRuleTemplate {
  offsetHours: number;
  action: string;
  level: number;
}

export const DEFAULT_ESCALATION_LADDER: EscalationRuleTemplate[] = [
  { offsetHours: -24, action: "remind_assignee", level: 1 },
  { offsetHours: 0, action: "mark_overdue_notify_pm", level: 2 },
  { offsetHours: 24, action: "escalate_owner", level: 3 },
  { offsetHours: 48, action: "schedule_review_lock", level: 4 },
];

export const ESCALATION_ACTION_LABELS = {
  remind_assignee: "Remind assignee",
  mark_overdue_notify_pm: "Mark overdue & notify lead",
  escalate_owner: "Escalate to owner",
  schedule_review_lock: "Schedule review & lock deadline",
} as const;

// ============================================================================
// CAMPAIGN TEMPLATES
//
// Blueprints for spinning up new campaigns quickly.
// ============================================================================

export interface CampaignTemplateConfig {
  workstreams: string[]; // slugs of workstreams to attach
  milestones: Array<{
    title: string;
    offsetDays: number;
  }>;
  tasks: Array<{
    title: string;
    workstream: string; // slug
    offsetDays: number;
    estimateHours: number;
    priority: string;
  }>;
}

export interface CampaignTemplateData {
  key: string;
  name: string;
  description: string;
  config: CampaignTemplateConfig;
}

export const DEFAULT_TEMPLATES: CampaignTemplateData[] = [
  {
    key: "product-launch",
    name: "Product Launch",
    description: "Strategy → Planning → Execution → Launch campaign for a new product",
    config: {
      workstreams: ["strategy", "planning", "execution", "launch", "change-requests"],
      milestones: [
        { title: "Strategy approved", offsetDays: 14 },
        { title: "Planning complete", offsetDays: 28 },
        { title: "Execution halfway", offsetDays: 42 },
        { title: "Launch ready", offsetDays: 56 },
      ],
      tasks: [
        { title: "Market research", workstream: "strategy", offsetDays: 7, estimateHours: 20, priority: "high" },
        { title: "Requirements gathering", workstream: "planning", offsetDays: 14, estimateHours: 16, priority: "high" },
        { title: "Design system", workstream: "execution", offsetDays: 21, estimateHours: 40, priority: "high" },
        { title: "Development sprint 1", workstream: "execution", offsetDays: 35, estimateHours: 80, priority: "high" },
        { title: "QA & launch prep", workstream: "launch", offsetDays: 50, estimateHours: 20, priority: "high" },
      ],
    },
  },
  {
    key: "feature-delivery",
    name: "Feature Delivery Campaign",
    description: "Plan, build, and ship a single product feature campaign",
    config: {
      workstreams: ["planning", "execution", "change-requests"],
      milestones: [
        { title: "Spec review", offsetDays: 7 },
        { title: "Development done", offsetDays: 21 },
        { title: "Shipped", offsetDays: 28 },
      ],
      tasks: [
        { title: "Write spec", workstream: "planning", offsetDays: 5, estimateHours: 8, priority: "high" },
        { title: "Development", workstream: "execution", offsetDays: 20, estimateHours: 40, priority: "high" },
        { title: "Code review", workstream: "execution", offsetDays: 22, estimateHours: 4, priority: "high" },
        { title: "Deployment", workstream: "execution", offsetDays: 28, estimateHours: 2, priority: "high" },
      ],
    },
  },
  {
    key: "marketing-campaign",
    name: "Marketing Campaign",
    description: "Plan, create, and launch a comprehensive marketing campaign",
    config: {
      workstreams: ["strategy", "planning", "execution", "change-requests"],
      milestones: [
        { title: "Campaign brief approved", offsetDays: 10 },
        { title: "Assets created", offsetDays: 24 },
        { title: "Campaign live", offsetDays: 31 },
      ],
      tasks: [
        { title: "Campaign strategy", workstream: "strategy", offsetDays: 7, estimateHours: 16, priority: "high" },
        { title: "Asset creation", workstream: "execution", offsetDays: 20, estimateHours: 32, priority: "high" },
        { title: "Copy & messaging", workstream: "planning", offsetDays: 20, estimateHours: 12, priority: "high" },
        { title: "Launch setup", workstream: "execution", offsetDays: 28, estimateHours: 8, priority: "high" },
      ],
    },
  },
  {
    key: "sprint",
    name: "Sprint Campaign",
    description: "One-week sprint campaign for cross-functional work",
    config: {
      workstreams: ["execution", "change-requests"],
      milestones: [
        { title: "Sprint review", offsetDays: 7 },
      ],
      tasks: [
        { title: "Sprint kickoff", workstream: "execution", offsetDays: 1, estimateHours: 2, priority: "medium" },
        { title: "Daily standups", workstream: "execution", offsetDays: 6, estimateHours: 5, priority: "medium" },
      ],
    },
  },
];

// ============================================================================
// DEPARTMENTS
//
// Seeded default team departments (customizable in Admin).
// ============================================================================

export interface DepartmentData {
  name: string;
  slug: string;
  sortOrder: number;
}

export const DEFAULT_DEPARTMENTS: DepartmentData[] = [
  { name: "Design", slug: "design", sortOrder: 0 },
  { name: "Development", slug: "development", sortOrder: 1 },
  { name: "Marketing", slug: "marketing", sortOrder: 2 },
  { name: "Operations", slug: "operations", sortOrder: 3 },
  { name: "Strategy", slug: "strategy", sortOrder: 4 },
];

// ============================================================================
// ASSET CATEGORIES
//
// The brand & resource hub's organizational structure.
// Seeded, admin-extensible via the Asset Categories admin tab.
// ============================================================================

export interface AssetCategoryData {
  key: string;
  name: string;
  icon?: string;
  sortOrder: number;
  isSystem?: boolean;
}

export const DEFAULT_ASSET_CATEGORIES: AssetCategoryData[] = [
  { key: "brand-assets", name: "Brand Assets", icon: "🎨", sortOrder: 0, isSystem: true },
  { key: "websites", name: "Websites", icon: "🌐", sortOrder: 1, isSystem: true },
  { key: "design", name: "Design", icon: "✏️", sortOrder: 2, isSystem: true },
  { key: "development", name: "Development", icon: "⚙️", sortOrder: 3, isSystem: true },
  { key: "marketing", name: "Marketing", icon: "📢", sortOrder: 4, isSystem: true },
  { key: "documents", name: "Documents", icon: "📄", sortOrder: 5, isSystem: true },
  { key: "content", name: "Content", icon: "📹", sortOrder: 6, isSystem: true },
  { key: "resources", name: "Custom Resources", icon: "📦", sortOrder: 7, isSystem: false },
];

// ============================================================================
// STALE DEAL DETECTION (legacy, may be removed in future)
// ============================================================================

// How many days without activity before a deal is considered "stale"?
export const STALE_DEAL_DAYS = 5;
