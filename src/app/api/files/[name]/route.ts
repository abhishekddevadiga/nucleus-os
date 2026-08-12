import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { ForbiddenError, ValidationError } from "@/lib/tasks";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Serves uploaded invoice files. Finance/CEO only — same audience as the
// Money section.
export const GET = withUser(async (_req, user, params) => {
  if (!user.isCeo && !user.isFinance) {
    throw new ForbiddenError("Only Finance or CEO/Ops can download invoice files.");
  }
  const name = path.basename(params.name); // no traversal
  const full = path.join(UPLOAD_DIR, name);
  const data = await fs.readFile(full).catch(() => null);
  if (!data) throw new ValidationError("File not found.");
  const type = TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(data, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
