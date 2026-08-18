import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { businessId } = await params;
  const body = await req.json();

  const {
    name,
    categoryId,
    kind,
    description,
    tags = [],
    url,
  } = body;

  if (!name || !categoryId || !kind) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Verify business exists and user has access
  const business = await db.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    return new Response("Business not found", { status: 404 });
  }

  try {
    const asset = await db.asset.create({
      data: {
        name,
        businessId,
        categoryId,
        kind,
        description: description || null,
        url: kind === "link" ? url : null,
        addedById: user.id,
        tags: tags.length > 0 ? {
          create: tags.map((tagId: string) => ({
            tagId,
          })),
        } : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    return new Response(JSON.stringify(asset), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Asset creation error:", error);
    return new Response("Failed to create asset", { status: 500 });
  }
}
