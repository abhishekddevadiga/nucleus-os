import { promises as fs } from "fs";
import path from "path";
import { withUser, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError, ForbiddenError } from "@/lib/tasks";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

// Upload the CA-issued invoice file (multipart/form-data, field "file").
// Stored under uploads/ (gitignored) and served via /api/files/[name].
export const POST = withUser(async (req, user, params) => {
  if (!user.isCeo && !user.isFinance) {
    throw new ForbiddenError("Only Finance or CEO/Ops can upload invoice files.");
  }
  const invoice = await db.invoice.findFirst({ where: { id: params.id, archivedAt: null } });
  if (!invoice) throw new ValidationError("Invoice not found.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ValidationError("Attach the invoice file (PDF or image).");
  if (file.size === 0) throw new ValidationError("File is empty.");
  if (file.size > MAX_BYTES) throw new ValidationError("File too large (max 15 MB).");
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.includes(ext)) throw new ValidationError(`Allowed types: ${ALLOWED.join(", ")}`);

  const stored = `${invoice.id}-${Date.now()}${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));

  await db.invoice.update({
    where: { id: invoice.id },
    data: { fileName: file.name, filePath: stored },
  });
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "invoice", entityId: invoice.id,
    action: "file_uploaded", toValue: file.name,
    meta: { size: file.size },
    clientId: invoice.clientId, projectId: invoice.projectId,
  });
  return ok({ filePath: stored });
});
