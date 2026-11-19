import {
  invalidResourceIdResponse,
  proxyControlApi,
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
  return proxyControlApi(
    request,
    `/v1/providers/${encodeURIComponent(provider)}/wallet-link-challenges`,
    { method: "POST", body: "{}" },
  );
}
