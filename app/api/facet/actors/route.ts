import {
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
} from "@/lib/control-api-server";

export async function POST(request: Request): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedRequestBody(request, 256 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("Actor publish");
    }
    throw error;
  }
  return proxyControlApi(request, "/v1/actors", { method: "POST", body });
}
