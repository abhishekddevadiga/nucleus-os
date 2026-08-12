import { withUser, ok, body } from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/tasks";
import { ASSET_TYPES } from "@/lib/constants";

export const POST = withUser(async (req, user) => {
  const input = await body<{
    clientId: string;
    projectId?: string;
    verticalId?: string;
    name: string;
    url: string;
    type: string;
    tags?: string;
    parentAssetId?: string;
    taskId?: string;
    direction?: "input" | "output";
  }>(req);
  if (!input.name?.trim()) throw new ValidationError("Asset name required.");
  if (!input.url?.trim()) throw new ValidationError("Asset link (Drive/Dropbox/Frame.io URL) required.");
  if (!ASSET_TYPES.includes(input.type as never)) throw new ValidationError("Invalid asset type.");
  const client = await db.client.findFirst({ where: { id: input.clientId, archivedAt: null } });
  if (!client) throw new ValidationError("Client not found.");
  if (input.parentAssetId) {
    const parent = await db.asset.findFirst({ where: { id: input.parentAssetId, clientId: input.clientId } });
    if (!parent) throw new ValidationError("Parent asset (chain) not found on this client.");
  }

  const asset = await db.asset.create({
    data: {
      clientId: input.clientId,
      projectId: input.projectId || null,
      verticalId: input.verticalId || null,
      name: input.name.trim(),
      url: input.url.trim(),
      type: input.type,
      tags: input.tags?.trim() || null,
      parentAssetId: input.parentAssetId || null,
      registeredById: user.id,
    },
  });
  if (input.taskId) {
    await db.taskAsset.create({
      data: { taskId: input.taskId, assetId: asset.id, direction: input.direction ?? "output" },
    });
  }
  await logActivity({
    actorId: user.id, actorName: user.name,
    entityType: "asset", entityId: asset.id,
    action: "registered", toValue: asset.name,
    meta: { type: asset.type, url: asset.url },
    clientId: input.clientId, projectId: input.projectId, taskId: input.taskId,
  });
  return ok({ id: asset.id });
});
