import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import MyWork from "@/components/mywork/MyWork";

export const metadata: Metadata = { title: "My Work" };

// My Work — a member's personal daily view. Overdue pinned first, then Today,
// This Week (by day), and a collapsed Backlog. Demo dataset lives client-side.
export default async function MyWorkPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <MyWork />;
}
