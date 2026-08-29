import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/app/page-header";
import { SearchClient } from "@/components/search/search-client";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Search & Ask"
        description="Search your lectures, or ask a question grounded in them."
      />
      <SearchClient />
    </div>
  );
}
