import { withUser, ok, body, requireCeo } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { hashPassword } from "@/lib/auth";
import { ValidationError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  requireCeo(user);
  const input = await body<{
    name: string;
    email: string;
    password: string;
    title?: string;
    capacityHours?: number;
  }>(req);

  if (!input.name?.trim() || !input.email?.trim()) throw new ValidationError("Name and email required.");
  if (!input.password || input.password.length < 6) throw new ValidationError("Password must be at least 6 characters.");

  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) throw new ValidationError("Email already in use.");

  const colors = ["#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#ca8a04", "#4f46e5", "#0d9488"];
  const created = await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      title: input.title?.trim() || null,
      capacityHours: input.capacityHours ?? 40,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      roleAssignments: {
        create: { role: "member", scopeType: "organization", scopeId: "org" },
      },
    },
  });

  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "user", entityId: created.id,
    action: "created", toValue: created.name, meta: { role: "member" },
  });

  return ok({ id: created.id });
});
