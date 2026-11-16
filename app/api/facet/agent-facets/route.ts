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
      return requestTooLargeResponse("Agent Facet publish");
    }
    throw error;
  }
  return proxyControlApi(request, "/v1/agent-facets", { method: "POST", body });
}
