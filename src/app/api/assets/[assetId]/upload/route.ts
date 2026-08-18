import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { assetId } = await params;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // Validate asset exists
    const asset = await db.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return new Response("Asset not found", { status: 404 });
    }

    // Validate file size (15MB max)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      return new Response("File too large (max 15MB)", { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "assets", asset.businessId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const originalName = file.name.replace(/[^a-z0-9.-]/gi, "_").toLowerCase();
    const filename = `${timestamp}-${randomId}-${originalName}`;
    const filepath = join(uploadsDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    // Update asset with file info
    const updated = await db.asset.update({
      where: { id: assetId },
      data: {
        kind: "file",
        fileName: file.name,
        filePath: `${asset.businessId}/${filename}`,
        fileSize: file.size,
        mimeType: file.type,
        url: null,
      },
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response("Failed to upload file", { status: 500 });
  }
}
