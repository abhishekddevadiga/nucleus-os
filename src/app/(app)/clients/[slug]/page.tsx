import { redirect } from "next/navigation";
import Link from "next/link";

// This route is deprecated. Redirect to the new businesses route.
export default async function ClientDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/businesses/${slug}`);
}
