import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/permissions";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const {
    name,
    businessId,
    campaignType = "general",
    ownerId,
    objective,
    goals,
    startDate,
    endDate,
    priority = "medium",
    status = "planning",
    description,
    notes,
  } = body;

  if (!name || !businessId || !ownerId) {
    return new Response("Missing required fields", { status: 400 });
  }

  const campaign = await db.campaign.create({
    data: {
      name,
      businessId,
      campaignType,
      ownerId,
      objective: objective || null,
      goals: goals || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      priority,
      status,
      description: description || null,
      notes: notes || null,
    },
  });

  return new Response(JSON.stringify(campaign), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
