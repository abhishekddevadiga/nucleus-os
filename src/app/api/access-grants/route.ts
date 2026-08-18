import { NextResponse } from "next/server";
import { body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await requireUser();
  const input = await body<{ businessId: string; userId: string; property: string; notes?: string; revokeId?: string }>(req);

  try {
    if (input.revokeId) {
      const grant = await db.accessGrant.findUnique({ where: { id: input.revokeId } });
      if (!grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await db.accessGrant.delete({ where: { id: input.revokeId } });
      await db.activityLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: "revoked", toValue: grant.property, businessId: grant.businessId,
          entityType: "access_grant",
          entityId: input.revokeId,
        },
      });
      return NextResponse.json({ ok: true });
    }
    const grant = await db.accessGrant.create({
      data: { businessId: input.businessId, userId: input.userId, property: input.property.trim(), notes: input.notes?.trim() || null },
    });
    await db.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        action: "granted", toValue: input.property, businessId: input.businessId,
        entityType: "access_grant",
        entityId: grant.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
