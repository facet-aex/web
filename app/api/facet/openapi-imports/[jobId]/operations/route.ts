import {
  invalidJobIdResponse,
  proxyControlApi,
  validateJobId,
} from "@/lib/control-api-server";

interface ImportOperationsRouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(
  request: Request,
  context: ImportOperationsRouteContext,
): Promise<Response> {
  const { jobId } = await context.params;
  if (!validateJobId(jobId)) return invalidJobIdResponse();

  return proxyControlApi(
    request,
    `/v1/openapi-imports/${jobId}/operations`,
  );
}
