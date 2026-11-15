import {
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
} from "@/lib/control-api-server";

export async function GET(request: Request): Promise<Response> {
  return proxyControlApi(request, "/v1/me/providers");
}

export async function POST(request: Request): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedRequestBody(request, 16 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error))
      return requestTooLargeResponse("Provider");
    throw error;
  }
  return proxyControlApi(request, "/v1/providers", { method: "POST", body });
}
