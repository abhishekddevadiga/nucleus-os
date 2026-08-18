import { NextResponse } from "next/server";
import { body } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await requireUser();
  const input = await body<{ entityType: string; entityId: string; body: string }>(req);

  let campaignId: string | null = null;
  let businessId: string | null = null;
  let taskId: string | null = null;

  if (input.entityType === "task") {
    const task = await db.task.findUnique({ where: { id: input.entityId }, include: { campaign: true } });
    if (!task) throw new Error("Task not found.");
    campaignId = task.campaignId;
    businessId = task.campaign.businessId;
    taskId = task.id;
  } else if (input.entityType === "campaign") {
    const campaign = await db.campaign.findUnique({ where: { id: input.entityId } });
    if (!campaign) throw new Error("Campaign not found.");
    campaignId = campaign.id;
    businessId = campaign.businessId;
  }

  const comment = await db.comment.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body.trim(),
      authorId: user.id,
    },
  });

  await db.activityLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      action: "commented",
      entityType: input.entityType,
      entityId: input.entityId,
      campaignId,
      businessId,
      taskId,
    },
  });

  return NextResponse.json({ id: comment.id });
}
