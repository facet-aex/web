export type FacetType =
  "EXTERNAL_HTTP_API" | "HOSTED_ACTOR" | "AUTONOMOUS_AGENT";

export type PricingModel = "PAY_PER_RUN" | "PAY_PER_RESULT";

export interface PublicFacet {
  id: string;
  versionId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  facetType?: FacetType;
  provider: { id: string; name: string; slug: string };
  displayVersion: string;
  method: string;
  inputSchema: unknown;
  outputSchema: unknown;
  pricing?: {
    model: PricingModel;
    priceAtomic: string;
    assetAddress: string;
    chainId: 43113;
    payTo: string;
  };
  actorMeta?: {
    runtime: string;
    imageDigest: string;
    registryTxHash?: string;
  };
  agentMeta?: {
    erc8004ChainId: 43113;
    erc8004Registry: string;
    erc8004TokenId: string;
    taskKind: string;
    registryTxHash?: string;
  };
  publishedAt: string;
}

export async function getPublicFacets(
  query = "",
  filters?: { type?: FacetType | ""; category?: string },
): Promise<PublicFacet[]> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) return [];
  try {
    const url = new URL("/v1/catalog/facets", baseUrl);
    if (query) url.searchParams.set("q", query);
    if (filters?.type) url.searchParams.set("type", filters.type);
    if (filters?.category) url.searchParams.set("category", filters.category);
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { facets: PublicFacet[] };
    return body.facets;
  } catch {
    return [];
  }
}

export async function getPublicFacet(
  id: string,
): Promise<PublicFacet | undefined> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) return undefined;
  try {
    const response = await fetch(new URL(`/v1/catalog/facets/${id}`, baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { facet: PublicFacet };
    return body.facet;
  } catch {
    return undefined;
  }
}
