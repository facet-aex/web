import { afterEach, expect, it, vi } from "vitest";

import { POST } from "@/app/api/facet/invoke/route";

const provider = "alice-labs";
const facetName = "vn-tech-news-actor";
const version = "1.0.0";

function makeInvokeRequest(options?: {
  idempotencyKey?: string;
  paymentSignature?: string;
  pricingModel?: "PAY_PER_RUN" | "PAY_PER_RESULT";
}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options?.idempotencyKey) {
    headers.set("idempotency-key", options.idempotencyKey);
  }
  if (options?.paymentSignature) {
    headers.set("payment-signature", options.paymentSignature);
  }
  return new Request("https://facet.example/api/facet/invoke", {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider,
      facetName,
      version,
      input: { topic: "AI", limit: 3 },
      ...(options?.pricingModel ? { pricingModel: options.pricingModel } : {}),
    }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("proxies unpaid 402 challenges without Clerk auth, never calls demo-payer, and forwards PAYMENT-REQUIRED", async () => {
  vi.stubEnv("FACET_ENV", "production");
  vi.stubEnv("FACET_AUTH_MODE", "clerk");
  vi.stubEnv("FACET_CONTROL_API_URL", "http://control-api:4000");
  vi.stubEnv("FACET_GATEWAY_URL", "http://gateway:4020");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example");
  vi.stubEnv("FACET_DEMO_PAYER_PRIVATE_KEY", `0x${"1".repeat(64)}`);

  const upstream = vi.fn<typeof fetch>(async () => {
    return new Response(JSON.stringify({ x402Version: 2, accepts: [] }), {
      status: 402,
      headers: {
        "content-type": "application/json",
        "PAYMENT-REQUIRED": "base64-challenge-header",
      },
    });
  });
  vi.stubGlobal("fetch", upstream);

  const response = await POST(
    makeInvokeRequest({
      idempotencyKey: "browser-run-1",
      pricingModel: "PAY_PER_RESULT",
    }),
  );

  expect(response.status).toBe(402);
  expect(response.headers.get("PAYMENT-REQUIRED")).toBe(
    "base64-challenge-header",
  );
  expect(await response.json()).toEqual({ x402Version: 2, accepts: [] });
  expect(upstream).toHaveBeenCalledOnce();

  const [calledUrl, init] = upstream.mock.calls[0] as [
    URL | string,
    RequestInit,
  ];
  expect(String(calledUrl)).toBe(
    `http://gateway:4020/v1/facets/${provider}/${facetName}/versions/${version}/invoke`,
  );
  expect(String(calledUrl)).not.toContain("demo-payer");
  const forwardedHeaders = new Headers(init.headers);
  expect(forwardedHeaders.get("idempotency-key")).toBe("browser-run-1");
  expect(forwardedHeaders.has("payment-signature")).toBe(false);
  expect(JSON.parse(String(init.body))).toEqual({
    input: { topic: "AI", limit: 3 },
    pricingModel: "PAY_PER_RESULT",
  });
});

it("forwards payment-signature and preserves 200 PAYMENT-RESPONSE header verbatim", async () => {
  vi.stubEnv("FACET_GATEWAY_URL", "http://gateway:4020");

  const upstream = vi.fn<typeof fetch>(async () => {
    return new Response(
      JSON.stringify({
        runId: "run-123",
        payment: { transaction: `0x${"a".repeat(64)}` },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "PAYMENT-RESPONSE": "base64-settle-header",
        },
      },
    );
  });
  vi.stubGlobal("fetch", upstream);

  const response = await POST(
    makeInvokeRequest({
      idempotencyKey: "browser-run-1",
      paymentSignature: "signed-x402-header",
      pricingModel: "PAY_PER_RUN",
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("PAYMENT-RESPONSE")).toBe("base64-settle-header");
  expect(await response.json()).toMatchObject({ runId: "run-123" });

  const [, init] = upstream.mock.calls[0] as [URL | string, RequestInit];
  const forwardedHeaders = new Headers(init.headers);
  expect(forwardedHeaders.get("idempotency-key")).toBe("browser-run-1");
  expect(forwardedHeaders.get("payment-signature")).toBe("signed-x402-header");
});

it("preserves 202 pending with retry-after and 502 refunded payload verbatim", async () => {
  vi.stubEnv("FACET_GATEWAY_URL", "http://gateway:4020");

  const upstream = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: "run-pending",
          payment: { status: "escrow_pending" },
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json",
            "retry-after": "2",
          },
        },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "ACTOR_EXECUTION_FAILED", message: "Actor threw" },
          runId: "run-refunded",
          payment: {
            status: "refunded",
            transaction: `0x${"b".repeat(64)}`,
            refundAmountAtomic: "10000",
          },
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  vi.stubGlobal("fetch", upstream);

  const pendingRes = await POST(
    makeInvokeRequest({
      idempotencyKey: "browser-run-2",
      paymentSignature: "sig-2",
      pricingModel: "PAY_PER_RESULT",
    }),
  );
  expect(pendingRes.status).toBe(202);
  expect(pendingRes.headers.get("retry-after")).toBe("2");
  expect(await pendingRes.json()).toEqual({
    runId: "run-pending",
    payment: { status: "escrow_pending" },
  });

  const refundedRes = await POST(
    makeInvokeRequest({
      idempotencyKey: "browser-run-3",
      paymentSignature: "sig-3",
      pricingModel: "PAY_PER_RESULT",
    }),
  );
  expect(refundedRes.status).toBe(502);
  expect(await refundedRes.json()).toMatchObject({
    runId: "run-refunded",
    payment: {
      status: "refunded",
      refundAmountAtomic: "10000",
    },
  });
});
