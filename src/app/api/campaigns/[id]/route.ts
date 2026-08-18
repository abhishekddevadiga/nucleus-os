import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  if (!(await canManageProject(user, id))) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    businessId,
    campaignType,
    ownerId,
    objective,
    goals,
    startDate,
    endDate,
    priority,
    status,
    description,
    notes,
  } = body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (businessId !== undefined) updateData.businessId = businessId;
  if (campaignType !== undefined) updateData.campaignType = campaignType;
  if (ownerId !== undefined) updateData.ownerId = ownerId;
  if (objective !== undefined) updateData.objective = objective || null;
  if (goals !== undefined) updateData.goals = goals || null;
  if (startDate !== undefined) updateData.startDate = new Date(startDate);
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
  if (priority !== undefined) updateData.priority = priority;
  if (status !== undefined) updateData.status = status;
  if (description !== undefined) updateData.description = description || null;
  if (notes !== undefined) updateData.notes = notes || null;

  const campaign = await db.campaign.update({
    where: { id },
    data: updateData,
  });

  return new Response(JSON.stringify(campaign), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  if (!(await canManageProject(user, id))) {
    return new Response("Forbidden", { status: 403 });
  }

  await db.campaign.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
