import { redirect } from "next/navigation";

// Invoicing is deprecated. Redirect to dashboard.
export default async function InvoicesPage() {
  redirect("/");
}
