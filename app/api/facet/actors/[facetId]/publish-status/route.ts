import {
  invalidResourceIdResponse,
  proxyControlApi,
  validateResourceId,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ facetId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { facetId } = await context.params;
  if (!validateResourceId(facetId)) return invalidResourceIdResponse("Actor");
  return proxyControlApi(request, `/v1/actors/${facetId}/publish-status`);
}
