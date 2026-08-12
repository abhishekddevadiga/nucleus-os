import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import TeamStructure from "@/components/team/TeamStructure";

export const metadata: Metadata = { title: "Team Structure" };

// Interactive org tree across every division. Structure lives
// client-side (src/lib/teamData.ts) — add/edit/reassign are in-memory for now.
export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <TeamStructure />;
}
