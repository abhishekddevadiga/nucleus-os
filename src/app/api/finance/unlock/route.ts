import { withUser, ok, body } from "@/lib/api";
import { financePassword, grantFinanceAccess } from "@/lib/financeGate";
import { ForbiddenError } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  if (!user.isCeo && !user.isFinance) {
    throw new ForbiddenError("Only Finance or CEO/Ops can access the money section.");
  }
  const input = await body<{ password: string }>(req);
  if (input.password !== financePassword()) {
    throw new ForbiddenError("Wrong password.");
  }
  await grantFinanceAccess();
  return ok();
});
