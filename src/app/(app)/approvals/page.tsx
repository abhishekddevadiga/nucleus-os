import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Approvals from "@/components/approvals/Approvals";

export const metadata: Metadata = { title: "Approvals" };

// Approvals — one inbox for every decision waiting on you: stage reviews,
// extension requests, ticket triage. Each is derived from a real item; acting
// performs the workflow action and logs it. Demo dataset lives client-side.
export default async function ApprovalsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isCeo && !user.isLead) redirect("/my-work");
  return <Approvals />;
}
