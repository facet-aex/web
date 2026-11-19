import { MyFacetsView } from "@/components/my-facets-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function MyFacetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    submitted?: string;
    status?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="studio-page-main">
        <MyFacetsView
          publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
          initialSubmitted={params.submitted}
          initialStatus={params.status}
          initialType={params.type}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
