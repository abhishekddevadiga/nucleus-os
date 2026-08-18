import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.isOwner) return new Response("Forbidden", { status: 403 });

  const body = await req.json();
  const {
    name,
    tagline,
    industry,
    status = "planned",
    description,
    website,
    contactEmail,
    contactPhone,
  } = body;

  if (!name) {
    return new Response("Business name is required", { status: 400 });
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Check if slug already exists
  const existing = await db.business.findUnique({
    where: { slug },
  });

  if (existing) {
    return new Response("A business with this name already exists", {
      status: 400,
    });
  }

  try {
    const business = await db.business.create({
      data: {
        name,
        slug,
        tagline: tagline || null,
        industry: industry || null,
        status,
        description: description || null,
        website: website || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        sortOrder: 0,
      },
    });

    return new Response(JSON.stringify(business), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Business creation error:", error);
    return new Response("Failed to create business", { status: 500 });
  }
}
