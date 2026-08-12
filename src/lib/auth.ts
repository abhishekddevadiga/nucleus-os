import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import type { Role } from "./constants";
import { BRAND } from "./brand";

const COOKIE_NAME = `${BRAND.slug}_session`;
const SESSION_DAYS = 14;

function secret() {
  return process.env.SESSION_SECRET || "dev-secret-do-not-use-in-prod";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex").slice(0, 32);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.session.create({ data: { userId, token, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (raw) {
    const [token] = raw.split(".");
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(COOKIE_NAME);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  capacityHours: number;
  avatarColor: string;
  roles: { role: Role; scopeType: string; scopeId: string }[];
  isCeo: boolean;
  isFinance: boolean;
  isSales: boolean;
  isLead: boolean;
};

// cache() dedupes lookups within a single request render tree.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [token, sig] = raw.split(".");
  if (!token || sig !== sign(token)) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { roleAssignments: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.archivedAt) return null;
  const u = session.user;
  const roles = u.roleAssignments.map((r) => ({
    role: r.role as Role,
    scopeType: r.scopeType,
    scopeId: r.scopeId,
  }));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    capacityHours: u.capacityHours,
    avatarColor: u.avatarColor,
    roles,
    isCeo: roles.some((r) => r.role === "ceo"),
    isFinance: roles.some((r) => r.role === "finance"),
    isSales: roles.some((r) => r.role === "sales"),
    isLead: roles.some((r) => r.role === "lead"),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Not authenticated");
  return user;
}

export class AuthError extends Error {}
