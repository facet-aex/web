import {
  invalidResourceIdResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
  validateResourceId,
} from "@/lib/control-api-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ facetId: string }> },
): Promise<Response> {
  const { facetId } = await context.params;
  if (!validateResourceId(facetId)) {
    return invalidResourceIdResponse("Facet");
  }

  let body: string;
  try {
    body = await readBoundedRequestBody(request, 8 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("Registry verification");
    }
    throw error;
  }

  return proxyControlApi(request, `/v1/facets/${facetId}/verify-registry`, {
    method: "POST",
    body,
  });
}
