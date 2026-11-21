import { decodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentRequired } from "@x402/core/types";
import { getAddress, keccak256, stringToHex, verifyTypedData, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import {
  AVALANCHE_CHAIN_ID,
  FUSD_ASSET_ADDRESS,
  connectBrowserWallet,
  ensureAvalancheChain,
  readBrowserEscrowState,
  readFusdBalanceAtomic,
  reclaimExpiredEscrowInBrowser,
  selectPaymentRequirement,
  signBrowserX402Payment,
  type Eip1193Provider,
} from "@/lib/browser-x402";

const TEST_ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const FEE_SPLIT_ADDRESS = "0xc50cb5d5ff6c71eb1b065971c198a9edb0ecff06";
const PROVIDER_PAY_TO = "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf";

function buildDualOptionRequired(overrides?: {
  payPerRunAmount?: string;
  payPerResultAmount?: string;
  asset?: string;
  network?: `eip155:${string}`;
}): PaymentRequired {
  return {
    x402Version: 2,
    resource: {
      url: "https://staging.facet.briandev.space/v1/facets/vn-data-labs/vn-tech-news-actor/versions/1.0.0/invoke",
      description: "VN Tech & Macro News Extractor",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: overrides?.network ?? "eip155:43113",
        asset: overrides?.asset ?? FUSD_ASSET_ADDRESS,
        amount: overrides?.payPerRunAmount ?? "10000",
        payTo: FEE_SPLIT_ADDRESS,
        maxTimeoutSeconds: 60,
        extra: {
          name: "FACET USD",
          version: "2",
          pricingModel: "PAY_PER_RUN",
          unitPriceAtomic: overrides?.payPerRunAmount ?? "10000",
          providerPayTo: PROVIDER_PAY_TO,
        },
      },
      {
        scheme: "exact",
        network: overrides?.network ?? "eip155:43113",
        asset: overrides?.asset ?? FUSD_ASSET_ADDRESS,
        amount: overrides?.payPerResultAmount ?? "10000",
        payTo: FEE_SPLIT_ADDRESS,
        maxTimeoutSeconds: 60,
        extra: {
          name: "FACET USD",
          version: "2",
          pricingModel: "PAY_PER_RESULT",
          unitPriceAtomic: "500",
          maxItemsCap: 20,
          providerPayTo: PROVIDER_PAY_TO,
        },
      },
    ],
  };
}

describe("browser-x402 wallet & EIP-3009 signing helpers", () => {
  it("connects a browser wallet and returns checksummed address and numeric chainId", async () => {
    const requestMock = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") {
        return [TEST_ACCOUNT.address.toLowerCase()];
      }
      if (method === "eth_chainId") {
        return "0xa869";
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const connected = await connectBrowserWallet({ request: requestMock });
    expect(connected).toEqual({
      address: TEST_ACCOUNT.address,
      chainId: AVALANCHE_CHAIN_ID,
    });
  });

  it("switches to Avalanche 0xa869 and adds Avalanche Testnet on 4902 without any Fuji text", async () => {
    const calls: Array<{ method: string; params?: unknown[] }> = [];
    const ethereum: Eip1193Provider = {
      async request(args) {
        calls.push(args);
        if (args.method === "wallet_switchEthereumChain") {
          const err = new Error("Unrecognized chain ID") as Error & {
            code: number;
          };
          err.code = 4902;
          throw err;
        }
        return null;
      },
    };

    await ensureAvalancheChain(ethereum);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa869" }],
    });
    expect(calls[1]).toEqual({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0xa869",
          chainName: "Avalanche Testnet",
          nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
          rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
          blockExplorerUrls: ["https://testnet.snowtrace.io"],
        },
      ],
    });
    expect(JSON.stringify(calls)).not.toMatch(/\bfuji\b/iu);
  });

  it("reads fUSD atomic balance via injected readBalance helper", async () => {
    const balance = await readFusdBalanceAtomic(TEST_ACCOUNT.address, {
      readBalance: async () => BigInt(1_250_000),
    });
    expect(balance).toBe("1250000");
  });

  it("selects PAY_PER_RESULT out of same-amount dual accepts[] and rejects tampered amount, math, providerPayTo, asset, or network", () => {
    const required = buildDualOptionRequired();

    const selected = selectPaymentRequirement(
      required,
      "PAY_PER_RESULT",
      "10000",
      PROVIDER_PAY_TO,
    );
    expect(selected.extra?.pricingModel).toBe("PAY_PER_RESULT");
    expect(selected.extra?.maxItemsCap).toBe(20);
    expect(selected.amount).toBe("10000");

    expect(() =>
      selectPaymentRequirement(required, "PAY_PER_RESULT", "5000"),
    ).toThrow(/amount/iu);

    expect(() =>
      selectPaymentRequirement(
        required,
        "PAY_PER_RESULT",
        "10000",
        "0x0000000000000000000000000000000000000002",
      ),
    ).toThrow(/providerPayTo/iu);

    const tamperedMath = buildDualOptionRequired({
      payPerResultAmount: "9000",
    });
    expect(() =>
      selectPaymentRequirement(tamperedMath, "PAY_PER_RESULT"),
    ).toThrow(/unitPrice \* maxItemsCap/iu);

    const wrongAsset = buildDualOptionRequired({
      asset: "0x0000000000000000000000000000000000000001",
    });
    expect(() =>
      selectPaymentRequirement(wrongAsset, "PAY_PER_RESULT", "10000"),
    ).toThrow(/asset/iu);

    const wrongNetwork = buildDualOptionRequired({ network: "eip155:1" });
    expect(() =>
      selectPaymentRequirement(wrongNetwork, "PAY_PER_RESULT", "10000"),
    ).toThrow(/network|chain/iu);
  });

  it("signs EIP-3009 TransferWithAuthorization via mock eth_signTypedData_v4 for ONLY the chosen option", async () => {
    const required = buildDualOptionRequired();
    const rpcCalls: Array<{ method: string; params?: unknown[] }> = [];

    const ethereum: Eip1193Provider = {
      async request(args) {
        rpcCalls.push(args);
        if (args.method === "eth_signTypedData_v4") {
          const [, rawTypedData] = args.params as [string, string];
          const parsed = JSON.parse(rawTypedData) as {
            domain: Record<string, unknown>;
            types: Record<string, Array<{ name: string; type: string }>>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          const { EIP712Domain: _ignored, ...restTypes } = parsed.types;
          return TEST_ACCOUNT.signTypedData({
            domain: parsed.domain as {
              name: string;
              version: string;
              chainId: number;
              verifyingContract: `0x${string}`;
            },
            types: restTypes,
            primaryType: parsed.primaryType,
            message: parsed.message,
          });
        }
        throw new Error(`Unexpected RPC method: ${args.method}`);
      },
    };

    const { paymentSignature, selected } = await signBrowserX402Payment({
      ethereum,
      address: TEST_ACCOUNT.address,
      required,
      pricingModel: "PAY_PER_RESULT",
      expectedAmountAtomic: "10000",
    });

    expect(selected.extra?.pricingModel).toBe("PAY_PER_RESULT");
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.method).toBe("eth_signTypedData_v4");

    const decoded = decodePaymentSignatureHeader(paymentSignature);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepted.extra?.pricingModel).toBe("PAY_PER_RESULT");
    expect(decoded.accepted.extra?.maxItemsCap).toBe(20);
    expect(decoded.accepted.amount).toBe("10000");
    expect(decoded.payload.authorization).toMatchObject({
      from: TEST_ACCOUNT.address,
      to: getAddress(FEE_SPLIT_ADDRESS),
      value: "10000",
    });
  });

  it("signs EIP-3009 ReceiveWithAuthorization when challenge extra specifies authorizationType=ReceiveWithAuthorization", async () => {
    const base = buildDualOptionRequired();
    const required: PaymentRequired = {
      ...base,
      accepts: base.accepts.map((option) => ({
        ...option,
        extra: {
          ...option.extra,
          authorizationType: "ReceiveWithAuthorization",
        },
      })),
    };
    const signedPrimaryTypes: string[] = [];

    const ethereum: Eip1193Provider = {
      async request(args) {
        if (args.method === "eth_signTypedData_v4") {
          const [, rawTypedData] = args.params as [string, string];
          const parsed = JSON.parse(rawTypedData) as {
            domain: Record<string, unknown>;
            types: Record<string, Array<{ name: string; type: string }>>;
            primaryType: string;
            message: Record<string, unknown>;
          };
          signedPrimaryTypes.push(parsed.primaryType);
          const { EIP712Domain: _ignored, ...restTypes } = parsed.types;
          return TEST_ACCOUNT.signTypedData({
            domain: parsed.domain as {
              name: string;
              version: string;
              chainId: number;
              verifyingContract: `0x${string}`;
            },
            types: restTypes,
            primaryType: parsed.primaryType,
            message: parsed.message,
          });
        }
        throw new Error(`Unexpected RPC method: ${args.method}`);
      },
    };

    const { paymentSignature } = await signBrowserX402Payment({
      ethereum,
      address: TEST_ACCOUNT.address,
      required,
      pricingModel: "PAY_PER_RESULT",
      expectedAmountAtomic: "10000",
    });

    expect(signedPrimaryTypes).toEqual(["ReceiveWithAuthorization"]);
    const decoded = decodePaymentSignatureHeader(paymentSignature);
    const rawPayload = decoded.payload as {
      authorization: {
        from: string;
        to: string;
        value: string;
        validAfter: string;
        validBefore: string;
        nonce: Hex;
      };
      signature: Hex;
    };
    const valid = await verifyTypedData({
      address: TEST_ACCOUNT.address,
      domain: {
        name: "FACET USD",
        version: "2",
        chainId: AVALANCHE_CHAIN_ID,
        verifyingContract: getAddress(FUSD_ASSET_ADDRESS),
      },
      types: {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: getAddress(rawPayload.authorization.from),
        to: getAddress(rawPayload.authorization.to),
        value: BigInt(rawPayload.authorization.value),
        validAfter: BigInt(rawPayload.authorization.validAfter),
        validBefore: BigInt(rawPayload.authorization.validBefore),
        nonce: rawPayload.authorization.nonce,
      },
      signature: rawPayload.signature,
    });
    expect(valid).toBe(true);
  });

  it("reads on-chain escrow state and submits permissionless refundEscrow(runKey) when expired", async () => {
    const runId = "019a1234-5678-7abc-8def-123456789abc";
    const runKey = keccak256(stringToHex(runId));
    const snapshot = await readBrowserEscrowState(runId, {
      readState: async () => ({
        state: "ESCROWED",
        payer: TEST_ACCOUNT.address,
        creatorPayTo: PROVIDER_PAY_TO,
        unitPriceAtomic: "500",
        maxAmountAtomic: "5000",
        expiresAtUnix: 1_577_836_800,
      }),
    });
    expect(snapshot.runKey).toBe(runKey);
    expect(snapshot.expired).toBe(true);
    expect(snapshot.state).toBe("ESCROWED");

    const sentCalls: Array<{ runKey: Hex }> = [];
    const ethereum: Eip1193Provider = {
      async request(args) {
        if (args.method === "wallet_switchEthereumChain") return null;
        throw new Error(`Unexpected ${args.method}`);
      },
    };
    const res = await reclaimExpiredEscrowInBrowser({
      ethereum,
      address: TEST_ACCOUNT.address,
      runId,
      readState: async () => ({
        state: "ESCROWED",
        payer: TEST_ACCOUNT.address,
        creatorPayTo: PROVIDER_PAY_TO,
        unitPriceAtomic: "500",
        maxAmountAtomic: "5000",
        expiresAtUnix: 1_577_836_800,
      }),
      submitRefund: async (keyArg) => {
        sentCalls.push({ runKey: keyArg });
        return `0x${"f".repeat(64)}`;
      },
    });
    expect(sentCalls).toEqual([{ runKey }]);
    expect(res.txHash).toBe(`0x${"f".repeat(64)}`);
    expect(res.refundAmountAtomic).toBe("5000");
  });
});
