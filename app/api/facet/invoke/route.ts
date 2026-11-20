import { randomUUID } from "node:crypto";

import {
  isValidFacetName,
  isValidSemver,
  isValidUsername,
  type PricingModel,
} from "@/lib/identifiers";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function isPricingModel(value: unknown): value is PricingModel {
  return value === "PAY_PER_RUN" || value === "PAY_PER_RESULT";
}

export async function POST(request: Request): Promise<Response> {
  const gatewayUrl = process.env.FACET_GATEWAY_URL ?? "http://127.0.0.1:4020";

  let payload: {
    provider?: unknown;
    facetName?: unknown;
    version?: unknown;
    input?: unknown;
    pricingModel?: unknown;
    idempotencyKey?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return errorResponse("INPUT_INVALID", "Invalid JSON payload.", 400);
  }

  if (
    typeof payload.provider !== "string" ||
    !isValidUsername(payload.provider) ||
    typeof payload.facetName !== "string" ||
    !isValidFacetName(payload.facetName) ||
    typeof payload.version !== "string" ||
    !isValidSemver(payload.version)
  ) {
    return errorResponse(
      "INPUT_INVALID",
      "Invalid provider, facetName, or SemVer version.",
      400,
    );
  }

  if (
    !payload.input ||
    typeof payload.input !== "object" ||
    Array.isArray(payload.input)
  ) {
    return errorResponse("INPUT_INVALID", "Input must be a JSON object.", 400);
  }

  if (
    payload.pricingModel !== undefined &&
    !isPricingModel(payload.pricingModel)
  ) {
    return errorResponse(
      "INPUT_INVALID",
      "pricingModel must be PAY_PER_RUN or PAY_PER_RESULT.",
      400,
    );
  }

  const headerIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  const bodyIdempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey.trim()
      : "";
  const idempotencyKey =
    headerIdempotencyKey && headerIdempotencyKey.length <= 128
      ? headerIdempotencyKey
      : bodyIdempotencyKey.length > 0 && bodyIdempotencyKey.length <= 128
        ? bodyIdempotencyKey
        : randomUUID();

  const invokeUrl = new URL(
    `/v1/facets/${encodeURIComponent(payload.provider)}/${encodeURIComponent(payload.facetName)}/versions/${encodeURIComponent(payload.version)}/invoke`,
    gatewayUrl,
  );

  const upstreamHeaders: Record<string, string> = {
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
  };
  const paymentSignature = request.headers.get("payment-signature");
  if (paymentSignature && paymentSignature.trim().length > 0) {
    upstreamHeaders["payment-signature"] = paymentSignature;
  }

  const upstreamBody = JSON.stringify({
    input: payload.input,
    ...(payload.pricingModel !== undefined
      ? { pricingModel: payload.pricingModel }
      : {}),
  });

  try {
    const upstream = await fetch(invokeUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: upstreamBody,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    const text = await upstream.text();
    const responseHeaders = new Headers();
    responseHeaders.set(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    );

    const paymentRequired = upstream.headers.get("payment-required");
    if (paymentRequired !== null) {
      responseHeaders.set("PAYMENT-REQUIRED", paymentRequired);
    }
    const paymentResponse = upstream.headers.get("payment-response");
    if (paymentResponse !== null) {
      responseHeaders.set("PAYMENT-RESPONSE", paymentResponse);
    }
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter !== null) {
      responseHeaders.set("retry-after", retryAfter);
    }

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return errorResponse(
      "GATEWAY_UNAVAILABLE",
      error instanceof Error
        ? error.message
        : "Unable to reach the FACET Gateway.",
      502,
    );
  }
}
