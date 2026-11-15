export interface PublicFacet {
  id: string;
  versionId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  provider: { id: string; name: string; slug: string };
  displayVersion: string;
  method: string;
  inputSchema: unknown;
  outputSchema: unknown;
  publishedAt: string;
}

export async function getPublicFacets(query = ""): Promise<PublicFacet[]> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) return [];
  try {
    const url = new URL("/v1/catalog/facets", baseUrl);
    if (query) url.searchParams.set("q", query);
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
