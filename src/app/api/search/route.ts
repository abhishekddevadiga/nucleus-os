import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleBusinessIds } from "@/lib/permissions";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return new Response(JSON.stringify({ results: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const visibleIds = await getVisibleBusinessIds(user);
  const where =
    visibleIds === "all" ? {} : { id: { in: visibleIds } };

  const [businesses, campaigns, tasks, assets, people] = await Promise.all([
    db.business.findMany({
      where: {
        ...where,
        archivedAt: null,
        name: { contains: q },
      },
      select: { id: true, name: true, slug: true },
      take: 5,
    }),
    db.campaign.findMany({
      where: {
        businessId: visibleIds === "all" ? undefined : { in: visibleIds },
        archivedAt: null,
        name: { contains: q },
      },
      select: { id: true, name: true, businessId: true },
      take: 5,
    }),
    db.task.findMany({
      where: {
        campaign: {
          businessId:
            visibleIds === "all" ? undefined : { in: visibleIds },
        },
        archivedAt: null,
        title: { contains: q },
      },
      select: { id: true, title: true, campaignId: true },
      take: 5,
    }),
    db.asset.findMany({
      where: {
        businessId: visibleIds === "all" ? undefined : { in: visibleIds },
        archivedAt: null,
        name: { contains: q },
      },
      select: { id: true, name: true, businessId: true },
      take: 5,
    }),
    db.user.findMany({
      where: {
        archivedAt: null,
        name: { contains: q },
      },
      select: { id: true, name: true },
      take: 5,
    }),
  ]);

  return new Response(
    JSON.stringify({
      results: {
        businesses,
        campaigns,
        tasks,
        assets,
        people,
      },
      total:
        businesses.length +
        campaigns.length +
        tasks.length +
        assets.length +
        people.length,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
