import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user.isOwner && !user.isLead) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    const { name, tagline, description, industry, website, contactEmail, contactPhone } = data;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    // Generate a slug from the name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");

    // Check if slug already exists
    const existing = await db.business.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "A business with this name already exists" }, { status: 400 });
    }

    const business = await db.business.create({
      data: {
        name: name.trim(),
        slug,
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        industry: industry?.trim() || null,
        website: website?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        status: "active",
        sortOrder: 0,
      },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        entityType: "business",
        entityId: business.id,
        action: "created",
        businessId: business.id,
      },
    });

    return NextResponse.json({ id: business.id, slug: business.slug });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 });
  }
}
