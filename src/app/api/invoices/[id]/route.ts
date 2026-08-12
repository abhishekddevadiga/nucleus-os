import { withUser, ok, body } from "@/lib/api";
import { setInvoiceStatus, recordPayment } from "@/lib/invoices";
import { ForbiddenError } from "@/lib/tasks";

export const PATCH = withUser(async (req, user, params) => {
  if (!user.isCeo && !user.isFinance) {
    throw new ForbiddenError("Only Finance or CEO/Ops can update invoices.");
  }
  const input = await body<{ status?: string; payment?: { amount: number; method?: string; reference?: string } }>(req);
  if (input.payment) {
    await recordPayment(user, params.id, input.payment.amount, input.payment.method, input.payment.reference);
  }
  if (input.status) {
    await setInvoiceStatus(user, params.id, input.status);
  }
  return ok();
});
