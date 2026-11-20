import {
  isValidFacetName,
  isValidSemver,
  isValidUsername,
  type FacetType,
  type PricingModel,
} from "@/lib/identifiers";

export type { FacetType, PricingModel };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface FacetPricingOption {
  model: PricingModel;
  priceAtomic: string;
  maxItemsCap?: number;
  maxAmountAtomic: string;
  assetAddress: string;
  chainId: 43113;
  payTo: string;
  isPrimary: boolean;
}

export interface ApiMeta {
  method: HttpMethod;
  pathTemplate: string;
  datasetPath?: string;
  staticHeaderNames?: string[];
  registryTxHash?: string;
  registryVerified?: boolean;
}

export interface PublicFacet {
  provider: string;
  facetName: string;
  facetDisplayName: string;
  version: string;
  facetType: FacetType;
  summary?: string;
  description: string;
  category: string;
  tags: string[];
  method: string;
  inputSchema: unknown;
  outputSchema: unknown;
  pricing?: {
    model: PricingModel;
    priceAtomic: string;
    maxItemsCap?: number;
    maxAmountAtomic?: string;
    assetAddress: string;
    chainId: 43113;
    payTo: string;
    isPrimary?: boolean;
  };
  pricingOptions?: FacetPricingOption[];
  apiMeta?: ApiMeta;
  actorMeta?: {
    runtime: string;
    imageDigest: string;
    runnerOciDigest?: string;
    registryTxHash?: string;
    registryVerified?: boolean;
  };
  agentMeta?: {
    erc8004ChainId: 43113;
    erc8004Registry: string;
    erc8004TokenId: string;
    taskKind: string;
    registryTxHash?: string;
    registryVerified?: boolean;
  };
  publishedAt: string;
}

export async function getPublicFacetByName(
  provider: string,
  facetName: string,
  version?: string,
): Promise<PublicFacet | undefined> {
  if (!isValidUsername(provider) || !isValidFacetName(facetName)) {
    return undefined;
  }
  if (version !== undefined && !isValidSemver(version)) {
    return undefined;
  }
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) return undefined;
  try {
    const path =
      version !== undefined
        ? `/v1/catalog/facets/${encodeURIComponent(provider)}/${encodeURIComponent(facetName)}/versions/${encodeURIComponent(version)}`
        : `/v1/catalog/facets/${encodeURIComponent(provider)}/${encodeURIComponent(facetName)}`;
    const response = await fetch(new URL(path, baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    return ((await response.json()) as { facet: PublicFacet }).facet;
  } catch {
    return undefined;
  }
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
