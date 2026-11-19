import {
  invalidResourceIdResponse,
  proxyControlApi,
  validateFacetName,
  validateSemver,
  validateUsername,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ provider: string; facetName: string; version: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { provider, facetName, version } = await context.params;
  if (
    !validateUsername(provider) ||
    !validateFacetName(facetName) ||
    !validateSemver(version)
  ) {
    return invalidResourceIdResponse("Actor version");
  }
  return proxyControlApi(
    request,
    `/v1/actors/${encodeURIComponent(provider)}/${encodeURIComponent(facetName)}/versions/${encodeURIComponent(version)}/publish-status`,
  );
}
