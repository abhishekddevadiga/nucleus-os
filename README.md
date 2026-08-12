# Nucleus OS

An operating system for running a services or product team — **one system, one login, one source of truth**.

It manages the complete lifecycle of work: **sales pipeline → project → verticals of work → tasks with enforced deadlines → tickets & change requests → assets & brand kits → milestones → invoices**, with an immutable timestamped activity log underneath everything.

> If work isn't in the tool, it doesn't exist.

Ships with **no demo data** — you create your own clients, projects, and people on first run.

## Quick start

```bash
npm install
cp .env.example .env        # set SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup            # push schema + create verticals, templates, and your admin account
npm run dev                 # http://localhost:3000
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env` (defaults to
`admin@example.com` / `changeme123` — change both before you deploy anywhere).

## Making it yours

Everything brand-specific lives in **one file**: [`src/lib/brand.ts`](src/lib/brand.ts).

```ts
export const BRAND = {
  name: "Nucleus",              // sidebar wordmark, company record
  productName: "Nucleus OS",    // page titles, login screen
  slug: "nucleus",              // cookie names, CSV export filenames
  emailDomain: "example.com",   // placeholder text, seeded admin address
};

export const LOCALE = "en-US";  // date + number formatting
export const CURRENCY = "USD";  // every money value in the app
```

Change those values (or set the matching `NEXT_PUBLIC_*` environment variables)
and the whole app follows — titles, wordmark, login copy, cookies, exports.

Set `LOCALE`/`CURRENCY` to whatever you bill in: `("en-GB", "GBP")`,
`("de-DE", "EUR")`, `("en-IN", "INR")`, and so on. Indian lakh/crore short
notation switches on automatically for `-IN` locales.

**Colours** live in [`tailwind.config.ts`](tailwind.config.ts) — swap the
`brand` ramp (and `--brand` in `src/app/globals.css`) to re-skin the entire
interface. Replace `public/logo.svg` with your own mark.

**Divisions** — the app ships with three generic ones (Client Services,
Products, Internal). Rename them in `prisma/seed.ts` before your first
`db:setup`, or edit them later in Admin.

## What's inside

| Module | Where |
|---|---|
| **Command Center** — live "who's on what", morning digest, project health (derived, not self-reported), overdue + escalation state | `/` |
| **My Work** — overdue pinned, today, this week; extension requests | `/my-work` |
| **Org tree** — Division → Client; internal brands/products are clients (`client_kind=internal`); "+ Add business" = new company live instantly | `/clients` |
| **Projects** — from templates (verticals + milestones + tasks with relative deadlines pre-attached), health board, archive-never-delete | `/projects` |
| **Boards** — kanban per vertical per project (drag & drop), list with overdue pinned, sheet, variation matrix | `/projects/[id]` |
| **Task detail** — pipeline stage mover, subtasks, comments, linked assets, extension requests, live escalation-ladder state, immutable timeline | `/tasks/[id]` |
| **Deadline & Escalation Engine** — no task/ticket/milestone without a due date (API-enforced); T−24h remind → T cross OVERDUE+PM → T+24h CEO → T+48h review + lock edits; sweeps every 60s | engine: `src/lib/escalation.ts` |
| **Tickets** — change/bug/revision; tasks in the Change Requests vertical, so they hit workload, deadlines, escalations automatically | project → Tickets |
| **CRM** — service pipeline (Won → one-click convert to Client+Project) and brand pipeline (Signed → fulfillment project); stale-deal detection | `/deals` |
| **Asset Hub & Brand Kit** — link-based assets with metadata, chaining (footage → master → variation), deliverables auto-archive on terminal stage, access vault (who-has-what, never passwords) | client page |
| **Workload** — estimates vs capacity per person per week, green/amber/red, shown at assignment time | `/workload` |
| **Task sheets & reports** — filterable live sheets, CSV export, stage-duration analytics from the activity log | `/reports` |
| **Money** — invoice from milestone (tax rate pre-filled), statuses with auto-overdue, partial payments, billed vs collected | `/invoices` |
| **Activity Log** — append-only, immutable; actor or SYSTEM; powers timelines, sheets, analytics | `/activity` |
| **Admin** — vertical builder (custom pipelines, no code), escalation ladder editor, users & scoped roles, template editor | `/admin` |

## Hard rules enforced at the API layer

- `task.due_date` **cannot be null** — creation is rejected without it (same for milestones and tickets).
- **Exactly one assignee** per task.
- **Deadline edits require a reason**; the original date is stored and displayed forever; the PM is notified on every change.
- **Assignees cannot edit their own deadlines** — they submit extension requests which the PM/CEO approves or rejects (all logged).
- After T+48h overdue, deadline edits are **locked** (CEO only).
- The activity log has **no update or delete code path**. Deleting anything = archiving (`archivedAt`); rows are never destroyed.

## Stack

- **Next.js 15** (App Router, TypeScript) — one deployable app, responsive by default (v1 is mobile-web, no native apps)
- **Prisma + SQLite** for dev — schema is Postgres-compatible; switch `datasource` provider + `DATABASE_URL` for production
- **Tailwind CSS** — no component library, fast loads
- Sessions: HMAC-signed cookie + DB session table, bcrypt passwords
- **Escalation engine**: in-process 60s sweep (`src/instrumentation.ts`) *and* an idempotent external-cron endpoint `POST /api/cron/escalations` (guard with `CRON_SECRET`) — both satisfy the "fires within 5 minutes" requirement
- Email/WhatsApp channels are recorded per-notification and stubbed — plug in your own provider in `src/lib/notify.ts`

## Production notes

- Use PostgreSQL: set `DATABASE_URL`, change `provider = "postgresql"` in `prisma/schema.prisma`, run `prisma migrate deploy`.
- Revoke `UPDATE`/`DELETE` on `ActivityLog` for the app's DB user — the append-only guarantee then holds at the DB-permission level too .
- Set a strong `SESSION_SECRET`, run daily backups, retain `ActivityLog` at audit grade.
- Serverless hosts: schedule `POST /api/cron/escalations` every minute instead of relying on the in-process interval.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | dev server |
| `npm run build && npm start` | production |
| `npm run db:setup` | push schema + first-run setup (skips if already set up; delete `prisma/dev.db` to start over) |
| `npm run escalations:run` | one-off escalation sweep from the CLI |
| `npm run typecheck` | TypeScript check |
