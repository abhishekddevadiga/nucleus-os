import { withUser, ok, body } from "@/lib/api";
import { raiseTicket } from "@/lib/tasks";

export const POST = withUser(async (req, user) => {
  const input = await body<{
    projectId: string;
    title: string;
    ticketType: string;
    priority?: string;
    assigneeId: string;
    dueDate: string;
    description?: string;
    estimateHours?: number;
  }>(req);
  const ticket = await raiseTicket(user, input);
  return ok({ id: ticket.id });
});
