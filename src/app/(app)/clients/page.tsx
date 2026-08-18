import { redirect } from "next/navigation";

// This route is deprecated. Redirect to the new businesses route.
export default async function ClientsPage() {
  redirect("/businesses");
}
