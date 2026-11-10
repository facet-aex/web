import {
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
  requestTooLargeResponse,
} from "@/lib/control-api-server";

const MAX_FACET_COMMAND_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedRequestBody(request, MAX_FACET_COMMAND_BYTES);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("Facet draft");
    }
    throw error;
  }
  return proxyControlApi(request, "/v1/facets", { method: "POST", body });
}
