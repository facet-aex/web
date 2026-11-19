import { randomUUID } from "node:crypto";
import { x402Client } from "@x402/core/client";
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { proxyControlApi } from "@/lib/control-api-server";
import {
  isValidFacetName,
  isValidSemver,
  isValidUsername,
} from "@/lib/identifiers";

const FUSD_ASSET = "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const gatewayUrl = process.env.FACET_GATEWAY_URL ?? "http://127.0.0.1:4020";

  let payload: {
    provider?: unknown;
    facetName?: unknown;
    version?: unknown;
    input?: unknown;
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

  const idempotencyKey =
    typeof payload.idempotencyKey === "string" &&
    payload.idempotencyKey.length > 0 &&
    payload.idempotencyKey.length <= 128
      ? payload.idempotencyKey
      : randomUUID();

  const allowance = await proxyControlApi(request, "/v1/demo-payer/authorize", {
    method: "POST",
    body: JSON.stringify({
      provider: payload.provider,
      facetName: payload.facetName,
      version: payload.version,
      idempotencyKey,
    }),
  });
  if (!allowance.ok) return allowance;
  const grant = (await allowance.json().catch(() => null)) as {
    amountAtomic?: unknown;
    providerPayTo?: unknown;
  } | null;
  if (
    grant?.amountAtomic !== "1000" ||
    typeof grant.providerPayTo !== "string" ||
    !/^0x[a-f0-9]{40}$/iu.test(grant.providerPayTo)
  ) {
    return errorResponse(
      "DEMO_ALLOWANCE_INVALID",
      "Invalid browser demo allowance.",
      502,
    );
  }

  const invokeUrl = new URL(
    `/v1/facets/${encodeURIComponent(payload.provider)}/${encodeURIComponent(payload.facetName)}/versions/${encodeURIComponent(payload.version)}/invoke`,
    gatewayUrl,
  );
  const baseHeaders = {
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
  };
  const body = JSON.stringify({ input: payload.input });

  try {
    const first = await fetch(invokeUrl, {
      method: "POST",
      headers: baseHeaders,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    if (first.status !== 402) {
      const text = await first.text();
      return new Response(text, {
        status: first.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const payerKey = process.env.FACET_DEMO_PAYER_PRIVATE_KEY;
    const maxAtomic = process.env.FACET_DEMO_MAX_PAYMENT_ATOMIC ?? "100000";
    if (!payerKey || !/^0x[a-f0-9]{64}$/iu.test(payerKey)) {
      return errorResponse(
        "DEMO_PAYER_NOT_CONFIGURED",
        "Browser demo payer is not configured on the server.",
        503,
      );
    }

    const challengeHeader = first.headers.get("PAYMENT-REQUIRED");
    if (!challengeHeader) {
      return errorResponse(
        "PAYMENT_CHALLENGE_MISSING",
        "Gateway returned 402 without a PAYMENT-REQUIRED header.",
        502,
      );
    }

    const required = decodePaymentRequiredHeader(challengeHeader);
    const option = required.accepts[0];
    const expectedRecipient =
      process.env.FACET_FEE_SPLIT_ADDRESS ?? grant.providerPayTo;
    if (
      required.x402Version !== 2 ||
      !option ||
      option.network !== "eip155:43113" ||
      option.asset.toLowerCase() !== FUSD_ASSET.toLowerCase() ||
      option.amount !== grant.amountAtomic ||
      option.payTo.toLowerCase() !== expectedRecipient.toLowerCase() ||
      !/^[1-9][0-9]*$/u.test(option.amount) ||
      BigInt(option.amount) > BigInt(maxAtomic)
    ) {
      return errorResponse(
        "PAYMENT_CHALLENGE_NOT_ALLOWED",
        "Gateway x402 payment quote exceeded allowed demo bounds.",
        400,
      );
    }

    const client = x402Client.fromConfig({
      schemes: [
        {
          network: "eip155:43113",
          client: new ExactEvmScheme(
            privateKeyToAccount(payerKey as `0x${string}`),
          ),
        },
      ],
      spendControls: {
        allowedAssets: [
          {
            network: "eip155:43113",
            asset: FUSD_ASSET,
            maxAmountPerPayment: maxAtomic,
          },
        ],
      },
    });
    const signedPayment = await client.createPaymentPayload(required);

    const paid = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(signedPayment),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    const paidText = await paid.text();
    return new Response(paidText, {
      status: paid.status,
      headers: { "content-type": "application/json; charset=utf-8" },
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
