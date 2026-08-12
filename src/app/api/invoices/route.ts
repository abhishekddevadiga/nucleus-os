import { withUser, ok, body } from "@/lib/api";
import { createInvoice, type CreateInvoiceInput } from "@/lib/invoices";
import { ForbiddenError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  if (!user.isCeo && !user.isFinance && !user.isLead) {
    throw new ForbiddenError("Only Finance, leads or CEO/Ops can create invoices.");
  }
  const input = await body<CreateInvoiceInput>(req);
  const invoice = await createInvoice(user, input);
  return ok({ id: invoice.id, number: invoice.number });
});
