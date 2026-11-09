import {
  importTooLargeResponse,
  isRequestBodyLimitError,
  proxyControlApi,
  readBoundedRequestBody,
} from "@/lib/control-api-server";

export async function POST(request: Request): Promise<Response> {
  let body: string;
  try {
    body = await readBoundedRequestBody(request);
  } catch (error) {
    if (isRequestBodyLimitError(error)) return importTooLargeResponse();
    throw error;
  }

  return proxyControlApi(request, "/v1/openapi-imports", {
    method: "POST",
    body,
  });
}
