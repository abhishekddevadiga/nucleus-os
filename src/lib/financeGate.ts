import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { BRAND } from "./brand";

// Shared password gate on the finance (Money) section, on top of role checks.
// Password comes from FINANCE_PASSWORD in your .env file.

const COOKIE = `${BRAND.slug}_finance`;

function sign(value: string) {
  const secret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-prod";
  return createHmac("sha256", secret).update(`finance:${value}`).digest("hex").slice(0, 32);
}

export function financePassword() {
  return process.env.FINANCE_PASSWORD || "change-me";
}

export async function hasFinanceAccess(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  return raw === sign("unlocked");
}

export async function grantFinanceAccess() {
  const jar = await cookies();
  jar.set(COOKIE, sign("unlocked"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 3600, // re-ask every 8 hours
    path: "/",
  });
}
