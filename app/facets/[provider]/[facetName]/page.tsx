import { notFound } from "next/navigation";

import { FacetDetailView } from "@/components/facet-detail-view";
import { getPublicFacetByName } from "@/lib/public-catalog";

export default async function FacetDetailPage({
  params,
}: {
  params: Promise<{ provider: string; facetName: string }>;
}) {
  const { provider, facetName } = await params;
  const facet = await getPublicFacetByName(provider, facetName);
  if (!facet) notFound();
  return <FacetDetailView facet={facet} />;
}
