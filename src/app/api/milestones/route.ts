import { NextResponse } from "next/server";
import { body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function POST(req: Request) {
  const user = await requireUser();
  const input = await body<{ campaignId: string; title: string; dueDate: string }>(req);

  const project = await db.campaign.findUnique({ where: { id: input.campaignId } });
  if (!project) throw new Error("Pcampaign not found.");

  const milestone = await db.milestone.create({
    data: {
      campaignId: input.campaignId,
      title: input.title.trim(),
      dueDate: new Date(input.dueDate),
    },
  });
  
  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      entityType: "milestone",
      entityId: milestone.id,
      action: "created",
      toValue: milestone.title,
      campaignId: project.id,
      businessId: project.businessId,
    },
  });
  
  return ok({ id: milestone.id });
}
