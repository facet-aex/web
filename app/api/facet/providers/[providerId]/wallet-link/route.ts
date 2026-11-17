import {
  invalidResourceIdResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
  validateResourceId,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ providerId: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { providerId } = await context.params;
  if (!validateResourceId(providerId)) {
    return invalidResourceIdResponse("provider");
  }
  let body: string;
  try {
    body = await readBoundedRequestBody(request, 2 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("wallet link");
    }
    throw error;
  }
  return proxyControlApi(request, `/v1/providers/${providerId}/wallet-link`, {
    method: "POST",
    body,
  });
}
