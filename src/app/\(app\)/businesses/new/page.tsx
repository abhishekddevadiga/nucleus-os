import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";
import { QuickForm } from "@/components/QuickForm";

export const metadata: Metadata = {
  title: "New Business",
};

export default async function NewBusinessPage() {
  const user = await getSessionUser();
  if (!user || (!user.isOwner && !user.isLead)) redirect("/businesses");

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8 md:px-10 md:py-12">
      <div className="animate-page">
        <Link href="/businesses" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to Businesses
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Create a new business</h1>
        <p className="mt-1 text-sm text-slate-600">Add a new independent business unit, brand, or product to Aikyaa.</p>

        <div className="mt-8 max-w-2xl">
          <QuickForm
            action="/api/businesses"
            method="POST"
            fields={[
              { name: "name", label: "Business Name", type: "text", required: true },
              { name: "tagline", label: "Tagline", type: "text", required: false, placeholder: "e.g., A brief one-liner" },
              { name: "description", label: "Description", type: "textarea", required: false },
              { name: "industry", label: "Industry", type: "text", required: false, placeholder: "e.g., SaaS, Media, E-commerce" },
              { name: "website", label: "Website", type: "url", required: false },
              { name: "contactEmail", label: "Contact Email", type: "email", required: false },
              { name: "contactPhone", label: "Contact Phone", type: "text", required: false },
            ]}
            submitLabel="Create business"
            redirectOnSuccess="/businesses"
          />
        </div>
      </div>
    </main>
  );
}
