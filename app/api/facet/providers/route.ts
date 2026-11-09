import { proxyControlApi } from "@/lib/control-api-server";

export async function GET(request: Request): Promise<Response> {
  return proxyControlApi(request, "/v1/me/providers");
}
