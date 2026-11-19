import {
  invalidResourceIdResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
  validateFacetName,
  validateSemver,
  validateUsername,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ provider: string; facetName: string; version: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { provider, facetName, version } = await context.params;
  if (
    !validateUsername(provider) ||
    !validateFacetName(facetName) ||
    !validateSemver(version)
  ) {
    return invalidResourceIdResponse("Facet Version");
  }
  let body: string;
  try {
    body = await readBoundedRequestBody(request, 128 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("Facet validation");
    }
    throw error;
  }
  return proxyControlApi(
    request,
    `/v1/facets/${encodeURIComponent(provider)}/${encodeURIComponent(facetName)}/versions/${encodeURIComponent(version)}/validate`,
    {
      method: "POST",
      body,
    },
  );
}
