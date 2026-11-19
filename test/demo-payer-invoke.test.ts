import { afterEach, expect, it, vi } from "vitest";

import { POST } from "@/app/api/facet/invoke/route";

const provider = "alice-labs";
const facetName = "sui-token";
const version = "1.0.0";
const request = () =>
  new Request("https://facet.example/api/facet/invoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider,
      facetName,
      version,
      input: { symbol: "SUI" },
      idempotencyKey: "demo-1",
    }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("denies anonymous browser invocation before contacting the gateway", async () => {
  vi.stubEnv("FACET_ENV", "production");
  vi.stubEnv("FACET_AUTH_MODE", "clerk");
  vi.stubEnv("FACET_CONTROL_API_URL", "http://control-api:4000");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example");
  const upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  const result = await POST(request());
  expect(result.status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});

it("honors the durable allowance response before the gateway is contacted", async () => {
  vi.stubEnv("FACET_ENV", "local");
  vi.stubEnv("FACET_CONTROL_API_URL", "http://control-api:4000");
  vi.stubEnv("FACET_GATEWAY_URL", "http://gateway:4020");
  vi.stubEnv("FACET_LOCAL_DEV_USER", "owner");
  const upstream = vi.fn<typeof fetch>(async () =>
    Response.json(
      { error: { code: "DEMO_ALLOWANCE_EXHAUSTED" } },
      { status: 429 },
    ),
  );
  vi.stubGlobal("fetch", upstream);
  const result = await POST(request());
  expect(result.status).toBe(429);
  expect(upstream).toHaveBeenCalledOnce();
  expect(String(upstream.mock.calls[0]?.[0])).toBe(
    "http://control-api:4000/v1/demo-payer/authorize",
  );
});

it("uses the authorized version and terms for a bounded gateway request", async () => {
  vi.stubEnv("FACET_ENV", "local");
  vi.stubEnv("FACET_CONTROL_API_URL", "http://control-api:4000");
  vi.stubEnv("FACET_GATEWAY_URL", "http://gateway:4020");
  vi.stubEnv("FACET_LOCAL_DEV_USER", "owner");
  const upstream = vi.fn<typeof fetch>(async (url) =>
    String(url).includes("demo-payer/authorize")
      ? Response.json({
          amountAtomic: "1000",
          providerPayTo: "0x0000000000000000000000000000000000000001",
          remainingToday: 2,
        })
      : Response.json({ runId: "test-run" }),
  );
  vi.stubGlobal("fetch", upstream);
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(upstream).toHaveBeenCalledTimes(2);
  expect(String(upstream.mock.calls[1]?.[0])).toBe(
    `http://gateway:4020/v1/facets/${provider}/${facetName}/versions/${version}/invoke`,
  );
});
