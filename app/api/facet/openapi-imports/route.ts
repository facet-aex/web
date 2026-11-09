import { proxyControlApi } from "@/lib/control-api-server";

export async function POST(request: Request): Promise<Response> {
  return proxyControlApi(request, "/v1/openapi-imports", {
    method: "POST",
    body: await request.text(),
  });
}
