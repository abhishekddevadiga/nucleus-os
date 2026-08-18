import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVisibleBusinessIds } from "@/lib/permissions";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { assetId } = await params;

  try {
    const asset = await db.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        businessId: true,
      },
    });

    if (!asset) {
      return new Response("Asset not found", { status: 404 });
    }

    // Verify user has access to this business's assets
    const visibleBusinessIds = await getVisibleBusinessIds(user);
    if (visibleBusinessIds !== "all" && !visibleBusinessIds.includes(asset.businessId)) {
      return new Response("Unauthorized", { status: 403 });
    }

    if (!asset.filePath) {
      return new Response("File not available", { status: 400 });
    }

    // Read file from uploads directory
    const uploadsDir = join(process.cwd(), "public", "uploads", "assets");
    const filePath = join(uploadsDir, asset.filePath);

    try {
      const fileContent = await readFile(filePath);
      return new Response(fileContent, {
        status: 200,
        headers: {
          "Content-Type": asset.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${asset.fileName}"`,
        },
      });
    } catch (err) {
      return new Response("File not found", { status: 404 });
    }
  } catch (error) {
    console.error("File serving error:", error);
    return new Response("Failed to retrieve file", { status: 500 });
  }
}
