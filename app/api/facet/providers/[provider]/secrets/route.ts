import {
  invalidResourceIdResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
  validateUsername,
} from "@/lib/control-api-server";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { provider } = await context.params;
  if (!validateUsername(provider)) {
    return invalidResourceIdResponse("provider");
  }
  let body: string;
  try {
    body = await readBoundedRequestBody(request, 20 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("secret creation");
    }
    throw error;
  }
  return proxyControlApi(
    request,
    `/v1/providers/${encodeURIComponent(provider)}/secrets`,
    {
      method: "POST",
      body,
    },
  );
}
