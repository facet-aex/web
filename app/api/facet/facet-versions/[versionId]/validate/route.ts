import {
  invalidResourceIdResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
  validateResourceId,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ versionId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { versionId } = await context.params;
  if (!validateResourceId(versionId)) {
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
  return proxyControlApi(request, `/v1/facet-versions/${versionId}/validate`, {
    method: "POST",
    body,
  });
}
