import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";
import { ValidationError, ForbiddenError } from "./tasks";

// Small wrapper for API route handlers: auth + uniform error responses.

type Handler = (req: Request, user: SessionUser, params: Record<string, string>) => Promise<Response>;

export function withUser(fn: Handler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    try {
      const params = ctx?.params ? await ctx.params : {};
      return await fn(req, user, params);
    } catch (err) {
      if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}:`, err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }
}

export function requireCeo(user: SessionUser) {
  if (!user.isCeo) throw new ForbiddenError("Only CEO/Ops can do this.");
}
