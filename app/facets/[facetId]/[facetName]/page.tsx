import { notFound } from "next/navigation";

import { FacetDetailView } from "@/app/facets/[facetId]/page";
import { getPublicFacetByName } from "@/lib/public-catalog";

export default async function NamedFacetDetailPage({
  params,
}: {
  params: Promise<{ facetId: string; facetName: string }>;
}) {
  const { facetId: username, facetName } = await params;
  const facet = await getPublicFacetByName(username, facetName);
  if (!facet) notFound();
  return <FacetDetailView facet={facet} />;
}
