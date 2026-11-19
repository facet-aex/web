import { notFound } from "next/navigation";

import { FacetDetailView } from "@/components/facet-detail-view";
import { getPublicFacetByName } from "@/lib/public-catalog";

export default async function FacetVersionDetailPage({
  params,
}: {
  params: Promise<{ provider: string; facetName: string; version: string }>;
}) {
  const { provider, facetName, version } = await params;
  const facet = await getPublicFacetByName(provider, facetName, version);
  if (!facet) notFound();
  return <FacetDetailView facet={facet} />;
}
