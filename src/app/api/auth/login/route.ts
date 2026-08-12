import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  let email = "", password = "";
  try {
    const data = await req.json();
    email = String(data.email ?? "").trim().toLowerCase();
    password = String(data.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.archivedAt || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
