import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getImportJob } from "@/app/api/facet/openapi-imports/[jobId]/route";
import { proxyControlApi, validateJobId } from "@/lib/control-api-server";

const validJobId = "019a69b8-1f36-7a12-9ea4-777f09a777ef";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Control API server adapter", () => {
  it("forwards JSON to the fixed backend with no caching and local auth", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://localhost:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "demo-owner");

    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "INPUT_INVALID", message: "Invalid source" } },
        { status: 422 },
      ),
    );
    vi.stubGlobal("fetch", upstream);

    const request = new Request(
      "http://localhost:3000/api/facet/openapi-imports",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: "provider-1" }),
      },
    );
    const response = await proxyControlApi(request, "/v1/openapi-imports", {
      method: "POST",
      body: await request.text(),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INPUT_INVALID", message: "Invalid source" },
    });
    expect(upstream).toHaveBeenCalledOnce();

    const firstCall = upstream.mock.calls[0];
    if (!firstCall) throw new Error("Expected the Control API fetch");
    const [url, init] = firstCall;
    expect(String(url)).toBe("http://localhost:4000/v1/openapi-imports");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      body: '{"providerId":"provider-1"}',
    });
    expect(new Headers(init?.headers).get("x-facet-dev-user")).toBe(
      "demo-owner",
    );
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("returns a redacted unavailable response when the backend cannot be reached", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://secret-backend:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "secret-user");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED http://secret-backend:4000");
      }),
    );

    const response = await proxyControlApi(
      new Request("http://localhost:3000/api/facet/providers"),
      "/v1/me/providers",
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(serialized).toContain("CONTROL_API_UNAVAILABLE");
    expect(serialized).not.toContain("secret-backend");
    expect(serialized).not.toContain("secret-user");
  });

  it("recognizes UUID job identifiers", () => {
    expect(validateJobId(validJobId)).toBe(true);
    expect(validateJobId("../../health/ready")).toBe(false);
    expect(validateJobId("not-a-uuid")).toBe(false);
  });

  it("rejects a malformed job id before attempting an upstream request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await getImportJob(
      new Request("http://localhost:3000/api/facet/openapi-imports/not-a-uuid"),
      { params: Promise.resolve({ jobId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INPUT_INVALID" },
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
