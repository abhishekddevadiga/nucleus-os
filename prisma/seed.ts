import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_VERTICALS,
  DEFAULT_TEMPLATES,
  DEFAULT_ESCALATION_LADDER,
} from "../src/lib/constants";
import { BRAND } from "../src/lib/brand";

// ============================================================================
// FIRST-RUN SETUP
//
// Creates the scaffolding the app needs to boot — and nothing else. No demo
// clients, projects, tasks, or invoices: you add those from inside the app.
//
// What gets created:
//   • one company (named from BRAND in src/lib/brand.ts)
//   • three starter divisions (rename or add more in Admin)
//   • the default verticals + their pipeline stages
//   • the default escalation ladder
//   • the default project templates
//   • one owner/admin account
//
// Change the two constants below before running, or set ADMIN_EMAIL and
// ADMIN_PASSWORD in your .env file.
// ============================================================================

const ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? `admin@${BRAND.emailDomain}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

const db = new PrismaClient();

async function main() {
  const existing = await db.company.findFirst();
  if (existing) {
    console.log("Setup skipped — a company already exists.");
    console.log("To start over, delete prisma/dev.db and run `npm run db:setup` again.");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // ── Company & divisions ────────────────────────────────────────────────
  const company = await db.company.create({ data: { name: BRAND.name } });

  await Promise.all([
    db.division.create({ data: { companyId: company.id, name: "Client Services", slug: "services", sortOrder: 0 } }),
    db.division.create({ data: { companyId: company.id, name: "Products", slug: "products", sortOrder: 1 } }),
    db.division.create({ data: { companyId: company.id, name: "Internal", slug: "internal", sortOrder: 2 } }),
  ]);

  // ── Verticals + pipeline stages ────────────────────────────────────────
  for (const [i, v] of DEFAULT_VERTICALS.entries()) {
    await db.vertical.create({
      data: {
        companyId: company.id,
        name: v.name,
        slug: v.slug,
        isSystem: v.isSystem ?? false,
        sortOrder: i,
        stages: {
          create: v.stages.map((name, idx) => ({
            name,
            sortOrder: idx,
            isTerminal: idx === v.stages.length - 1,
          })),
        },
      },
    });
  }

  // ── Default escalation ladder (company scope) ──────────────────────────
  for (const rule of DEFAULT_ESCALATION_LADDER) {
    await db.escalationRule.create({
      data: {
        scopeType: "company",
        scopeId: company.id,
        offsetHours: rule.offsetHours,
        action: rule.action,
        level: rule.level,
      },
    });
  }

  // ── Project templates ──────────────────────────────────────────────────
  for (const t of DEFAULT_TEMPLATES) {
    await db.projectTemplate.create({
      data: { key: t.key, name: t.name, description: t.description, config: JSON.stringify(t.config) },
    });
  }

  // ── Owner account ──────────────────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      title: "Owner / Head of Operations",
      avatarColor: "#7b68ee",
      capacityHours: 40,
    },
  });

  await db.roleAssignment.create({
    data: { userId: admin.id, role: "ceo", scopeType: "company", scopeId: company.id },
  });

  console.log(`\n  ${BRAND.productName} is ready.\n`);
  console.log(`  Sign in:  ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n  Change this password from Admin as soon as you're in.\n`);
  console.log(`  Next: add your team in Admin → Users, then create your first`);
  console.log(`  client under Businesses and spin up a project from a template.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
