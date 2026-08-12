import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import CommandCenter from "@/components/command/CommandCenter";

export const dynamic = "force-dynamic";

// Command Center — the CEO / Head of Operations home. Six zones answering
// "what's broken, who's doing what, where is the money" at a glance.
// Demo dataset lives client-side (src/lib/commandData.ts).
export default async function CommandCenterPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isLead && !user.isFinance) redirect("/my-work");
  return <CommandCenter />;
}
