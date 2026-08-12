import { db } from "./db";
import { logActivity } from "./activity";
import { ValidationError } from "./tasks";
import type { SessionUser } from "./auth";

// Invoicing: invoice from milestone with pre-filled client, line
// items, amount, tax, due date. Statutory filing stays in your accounting tool —
// this tracks status + receivables by reference.

export interface CreateInvoiceInput {
  clientId: string;
  projectId?: string;
  milestoneId?: string;
  lineItems: { description: string; amount: number }[];
  taxPercent?: number;
  dueDate: string | Date;
  notes?: string;
  isInternal?: boolean;
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.invoice.count();
  return `SYM-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createInvoice(actor: SessionUser, input: CreateInvoiceInput) {
  const client = await db.client.findFirst({ where: { id: input.clientId, archivedAt: null } });
  if (!client) throw new ValidationError("Client not found.");
  // Tolerate `{"0": {...}}`-shaped payloads from indexed form field names.
  if (input.lineItems && !Array.isArray(input.lineItems)) {
    input.lineItems = Object.values(input.lineItems) as CreateInvoiceInput["lineItems"];
  }
  if (!input.lineItems?.length) throw new ValidationError("At least one line item is required.");
  const dueDate = new Date(input.dueDate);
  if (isNaN(dueDate.getTime())) throw new ValidationError("Invoice due date is required.");

  const subtotal = input.lineItems.reduce((s, li) => s + Math.round(li.amount), 0);
  const gst = input.taxPercent ?? 18;
  const total = Math.round(subtotal * (1 + gst / 100));

  const invoice = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      lineItems: JSON.stringify(input.lineItems),
      subtotal: subtotal,
      taxPercent: gst,
      total: total,
      dueDate,
      notes: input.notes ?? null,
      isInternal: input.isInternal ?? client.kind === "internal",
    },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "invoice",
    entityId: invoice.id,
    action: "created",
    toValue: invoice.number,
    meta: { total: total, milestoneId: input.milestoneId },
    clientId: input.clientId,
    projectId: input.projectId,
  });
  return invoice;
}

// Milestone completion -> draft invoice pre-filled (spec journey #8).
export async function completeMilestone(actor: SessionUser, milestoneId: string) {
  const milestone = await db.milestone.findFirst({
    where: { id: milestoneId, archivedAt: null },
    include: { project: { include: { client: true } } },
  });
  if (!milestone) throw new ValidationError("Milestone not found.");
  if (milestone.status === "completed") return { milestone, invoice: null };

  const updated = await db.milestone.update({
    where: { id: milestoneId },
    data: { status: "completed", completedAt: new Date() },
  });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "milestone",
    entityId: milestoneId,
    action: "completed",
    toValue: milestone.title,
    projectId: milestone.projectId,
    clientId: milestone.project.clientId,
  });

  let invoice = null;
  if (milestone.billable) {
    invoice = await createInvoice(actor, {
      clientId: milestone.project.clientId,
      projectId: milestone.projectId,
      milestoneId: milestone.id,
      lineItems: [
        {
          description: `${milestone.project.name} — ${milestone.title}`,
          amount: milestone.amount || milestone.project.value,
        },
      ],
      dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000), // net-15 default
      notes: `Auto-drafted from milestone "${milestone.title}".`,
    });
  }
  return { milestone: updated, invoice };
}

export async function recordPayment(
  actor: SessionUser,
  invoiceId: string,
  amount: number,
  method?: string,
  reference?: string
) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, archivedAt: null },
    include: { payments: true },
  });
  if (!invoice) throw new ValidationError("Invoice not found.");
  if (amount <= 0) throw new ValidationError("Payment must be positive.");

  await db.payment.create({
    data: { invoiceId, amount: Math.round(amount), method: method ?? null, reference: reference ?? null },
  });
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0) + Math.round(amount);
  const status = paid >= invoice.total ? "paid" : "partial";
  const updated = await db.invoice.update({ where: { id: invoiceId }, data: { status } });

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "invoice",
    entityId: invoiceId,
    action: "payment_recorded",
    toValue: String(amount),
    meta: { status, paidTotal: paid, of: invoice.total },
    clientId: invoice.clientId,
    projectId: invoice.projectId,
  });
  return updated;
}

export async function setInvoiceStatus(actor: SessionUser, invoiceId: string, status: string) {
  const allowed = ["draft", "sent", "paid", "partial", "overdue"];
  if (!allowed.includes(status)) throw new ValidationError("Invalid status.");
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, archivedAt: null } });
  if (!invoice) throw new ValidationError("Invoice not found.");
  const updated = await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    entityType: "invoice",
    entityId: invoiceId,
    action: "status_changed",
    fromValue: invoice.status,
    toValue: status,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
  });
  return updated;
}
