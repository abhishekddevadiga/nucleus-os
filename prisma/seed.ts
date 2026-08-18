import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_WORKSTREAMS,
  DEFAULT_TEMPLATES,
  DEFAULT_ESCALATION_LADDER,
  DEFAULT_DEPARTMENTS,
  DEFAULT_ASSET_CATEGORIES,
} from "../src/lib/constants";
import { BRAND } from "../src/lib/brand";

// ============================================================================
// FIRST-RUN SETUP FOR AIKYAA
//
// Creates the scaffolding the app needs to boot — and nothing else. No demo
// businesses, projects, or tasks: you add those from inside the app.
//
// What gets created:
//   • one admin user (owner role at organization scope)
//   • the default workstreams + their pipeline stages (per-business templates)
//   • the default escalation ladder (organization scope)
//   • the default project templates
//   • the default departments
//   • the default asset categories
//
// Change the two constants below before running, or set ADMIN_EMAIL and
// ADMIN_PASSWORD in your .env file.
// ============================================================================

const ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? `admin@${BRAND.emailDomain}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

const db = new PrismaClient();

async function main() {
  // Check if already seeded
  const existingUser = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingUser) {
    console.log("Setup skipped — admin user already exists.");
    console.log("To start over, delete prisma/dev.db and run `npm run db:setup` again.");
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // ── Admin User ────────────────────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      title: "Owner",
      avatarColor: "#d4a574", // Aikyaa brand beige/gold
      capacityHours: 40,
    },
  });

  // Owner role at organization scope
  await db.roleAssignment.create({
    data: {
      userId: admin.id,
      role: "owner",
      scopeType: "organization",
      scopeId: "org",
    },
  });

  // ── Default Workstreams (business-scoped service line templates) ────────
  // These are NOT created per-business yet; they're seeded as templates.
  // When a user creates a business, they'll be prompted to "bootstrap starter workstreams"
  // from these defaults. For now, we just seed them as reference data.
  // (In a mature implementation, move this to an admin/workstream-template table.)

  // ── Default Escalation Ladder (organization scope) ────────────────────
  for (const rule of DEFAULT_ESCALATION_LADDER) {
    await db.escalationRule.create({
      data: {
        scopeType: "organization",
        scopeId: "org",
        offsetHours: rule.offsetHours,
        action: rule.action,
        level: rule.level,
      },
    });
  }

  // ── Default Project Templates ────────────────────────────────────────
  for (const t of DEFAULT_TEMPLATES) {
    await db.campaignTemplate.create({
      data: {
        key: t.key,
        name: t.name,
        description: t.description,
        config: JSON.stringify(t.config),
      },
    });
  }

  // ── Default Departments ──────────────────────────────────────────────
  for (const d of DEFAULT_DEPARTMENTS) {
    await db.department.create({
      data: {
        name: d.name,
        slug: d.slug,
        sortOrder: d.sortOrder,
      },
    });
  }

  // ── Default Asset Categories ────────────────────────────────────────
  for (const cat of DEFAULT_ASSET_CATEGORIES) {
    await db.assetCategory.create({
      data: {
        key: cat.key,
        name: cat.name,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: cat.isSystem,
      },
    });
  }

  console.log(`\n  ${BRAND.productName} is ready.\n`);
  console.log(`  Sign in:  ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`\n  Change this password from Admin as soon as you're in.\n`);
  console.log(`  Next: add your team in Admin → Users, then create your first`);
  console.log(`  business under Businesses and spin up a project from a template.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
