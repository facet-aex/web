import {
  invalidResourceIdResponse,
  proxyControlApi,
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
  return proxyControlApi(
    request,
    `/v1/providers/${providerId}/wallet-link-challenges`,
    { method: "POST", body: "{}" },
  );
}
