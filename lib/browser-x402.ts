import { x402Client } from "@x402/core/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import type {
  PaymentPayloadContext,
  PaymentPayloadResult,
  PaymentRequired,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import { type ClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { avalancheFuji } from "viem/chains";

import { FUJI_CHAIN_ID, FUJI_CONTRACTS } from "@/lib/facet-ui";
import type { PricingModel } from "@/lib/identifiers";

export const AVALANCHE_CHAIN_ID = FUJI_CHAIN_ID;
export const AVALANCHE_CHAIN_HEX = "0xa869" as const;
export const AVALANCHE_NETWORK = "eip155:43113" as const;
export const AVALANCHE_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
export const AVALANCHE_EXPLORER_URL = "https://testnet.snowtrace.io";
export const FUSD_ASSET_ADDRESS = FUJI_CONTRACTS.fusd;

const AVALANCHE_TESTNET_CHAIN: Chain = {
  ...avalancheFuji,
  name: "Avalanche Testnet",
};

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
}

export function getBrowserEthereumProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as Window & { ethereum?: Eip1193Provider })
    .ethereum;
  return candidate && typeof candidate.request === "function"
    ? candidate
    : undefined;
}

function requireEthereum(ethereum?: Eip1193Provider): Eip1193Provider {
  const provider = ethereum ?? getBrowserEthereumProvider();
  if (!provider) {
    throw new Error(
      "No EVM browser wallet detected. Install MetaMask or another browser wallet to sign x402 payments on Avalanche.",
    );
  }
  return provider;
}

function parseChainId(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^0x[0-9a-f]+$/iu.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }
    if (/^[0-9]+$/u.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
  }
  return Number.NaN;
}

function isUnrecognizedChainError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    cause?: { code?: unknown };
    data?: { originalError?: { code?: unknown } };
  };
  if (
    candidate.code === 4902 ||
    candidate.cause?.code === 4902 ||
    candidate.data?.originalError?.code === 4902
  ) {
    return true;
  }
  return (
    typeof candidate.message === "string" &&
    (candidate.message.includes("4902") ||
      /unrecognized chain/iu.test(candidate.message))
  );
}

export async function connectBrowserWallet(
  ethereum?: Eip1193Provider,
): Promise<{ address: Hex; chainId: number }> {
  const provider = requireEthereum(ethereum);
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const rawAddress = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof rawAddress !== "string" || !isAddress(rawAddress)) {
    throw new Error("Wallet did not return a valid EVM account address.");
  }
  const address = getAddress(rawAddress);
  const rawChainId = await provider.request({ method: "eth_chainId" });
  const chainId = parseChainId(rawChainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Wallet returned an invalid EVM chain ID.");
  }
  return { address, chainId };
}

export async function ensureAvalancheChain(
  ethereum?: Eip1193Provider,
): Promise<void> {
  const provider = requireEthereum(ethereum);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AVALANCHE_CHAIN_HEX }],
    });
  } catch (error) {
    if (!isUnrecognizedChainError(error)) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: AVALANCHE_CHAIN_HEX,
          chainName: "Avalanche Testnet",
          nativeCurrency: {
            name: "AVAX",
            symbol: "AVAX",
            decimals: 18,
          },
          rpcUrls: [AVALANCHE_RPC_URL],
          blockExplorerUrls: [AVALANCHE_EXPLORER_URL],
        },
      ],
    });
  }
}

export async function readFusdBalanceAtomic(
  address: Hex,
  options?: {
    rpcUrl?: string;
    readBalance?: (addr: Hex) => Promise<bigint>;
  },
): Promise<string> {
  const normalized = getAddress(address);
  if (options?.readBalance) {
    const balance = await options.readBalance(normalized);
    return balance.toString();
  }
  const publicClient = createPublicClient({
    chain: AVALANCHE_TESTNET_CHAIN,
    transport: http(options?.rpcUrl ?? AVALANCHE_RPC_URL),
  });
  const balance = await publicClient.readContract({
    address: FUSD_ASSET_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [normalized],
  });
  return balance.toString();
}

export function selectPaymentRequirement(
  required: PaymentRequired,
  pricingModel?: PricingModel,
  expectedAmountAtomic?: string,
  expectedProviderPayTo?: string,
): PaymentRequirements {
  if (
    !required ||
    required.x402Version !== 2 ||
    !Array.isArray(required.accepts) ||
    required.accepts.length === 0
  ) {
    throw new Error(
      "Gateway returned an unsupported x402 v2 payment challenge.",
    );
  }

  const selected = pricingModel
    ? required.accepts.find(
        (option) => option.extra?.pricingModel === pricingModel,
      )
    : required.accepts[0];

  if (!selected) {
    throw new Error(
      `Payment challenge does not include pricing option ${pricingModel ?? "default"}.`,
    );
  }

  if (selected.scheme !== "exact") {
    throw new Error(
      `Unsupported x402 payment scheme "${String(selected.scheme)}".`,
    );
  }

  if (selected.network !== AVALANCHE_NETWORK) {
    throw new Error(
      `Payment challenge targets network "${String(selected.network)}" instead of Avalanche (${AVALANCHE_NETWORK}).`,
    );
  }

  if (selected.asset.toLowerCase() !== FUSD_ASSET_ADDRESS.toLowerCase()) {
    throw new Error(
      `Payment challenge asset "${selected.asset}" does not match fUSD (${FUSD_ASSET_ADDRESS}).`,
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/u.test(selected.payTo)) {
    throw new Error("Payment challenge payTo address is invalid.");
  }

  if (selected.extra?.name !== "FACET USD" || selected.extra?.version !== "2") {
    throw new Error(
      "Payment challenge is missing FACET USD EIP-3009 domain metadata.",
    );
  }

  if (
    typeof selected.amount !== "string" ||
    !/^[1-9][0-9]*$/u.test(selected.amount)
  ) {
    throw new Error("Payment challenge amount is invalid.");
  }

  if (selected.extra.providerPayTo !== undefined) {
    if (
      typeof selected.extra.providerPayTo !== "string" ||
      !/^0x[a-fA-F0-9]{40}$/u.test(selected.extra.providerPayTo)
    ) {
      throw new Error("Payment challenge providerPayTo address is invalid.");
    }
    if (
      expectedProviderPayTo &&
      selected.extra.providerPayTo.toLowerCase() !==
        expectedProviderPayTo.toLowerCase()
    ) {
      throw new Error(
        `Payment challenge providerPayTo ${selected.extra.providerPayTo} does not match expected ${expectedProviderPayTo}.`,
      );
    }
  } else if (expectedProviderPayTo) {
    throw new Error("Payment challenge is missing providerPayTo metadata.");
  }

  if (selected.extra.pricingModel === "PAY_PER_RESULT") {
    if (
      typeof selected.extra.unitPriceAtomic !== "string" ||
      !/^[1-9][0-9]*$/u.test(selected.extra.unitPriceAtomic)
    ) {
      throw new Error(
        "PAY_PER_RESULT payment challenge is missing a valid unitPriceAtomic.",
      );
    }
    if (
      typeof selected.extra.maxItemsCap !== "number" ||
      !Number.isInteger(selected.extra.maxItemsCap) ||
      selected.extra.maxItemsCap < 1 ||
      selected.extra.maxItemsCap > 1000
    ) {
      throw new Error(
        "PAY_PER_RESULT payment challenge is missing a valid maxItemsCap (1..1000).",
      );
    }
    const computedMax = (
      BigInt(selected.extra.unitPriceAtomic) *
      BigInt(selected.extra.maxItemsCap)
    ).toString();
    if (computedMax !== selected.amount) {
      throw new Error(
        `Payment challenge amount ${selected.amount} does not match unitPrice * maxItemsCap (${computedMax}).`,
      );
    }
  } else if (
    selected.extra.pricingModel === "PAY_PER_RUN" &&
    selected.extra.unitPriceAtomic !== undefined &&
    selected.extra.unitPriceAtomic !== selected.amount
  ) {
    throw new Error(
      `PAY_PER_RUN payment challenge unitPriceAtomic ${String(selected.extra.unitPriceAtomic)} does not match amount ${selected.amount}.`,
    );
  }

  if (
    expectedAmountAtomic !== undefined &&
    selected.amount !== expectedAmountAtomic
  ) {
    throw new Error(
      `Payment challenge amount ${selected.amount} does not match expected ${expectedAmountAtomic} atomic fUSD.`,
    );
  }

  return selected;
}

const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

const ESCROW_V2_ABI = parseAbi([
  "function runState(bytes32) view returns (uint8)",
  "function escrows(bytes32) view returns (bytes32 facetId,address payer,address creatorPayTo,uint256 unitPriceAtomic,uint256 maxAmount,uint64 expiresAt)",
  "function refundEscrow(bytes32 runId)",
]);

const RUN_STATE_NAMES = ["UNUSED", "ESCROWED", "SETTLED", "REFUNDED"] as const;
export type BrowserEscrowRunState = (typeof RUN_STATE_NAMES)[number];

function createRandomBytes32Hex(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

class ReceiveAuthorizationEvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact";
  private readonly fallback: ExactEvmScheme;
  readonly findDefaultAsset: ExactEvmScheme["findDefaultAsset"];

  constructor(private readonly signer: ClientEvmSigner) {
    this.fallback = new ExactEvmScheme(signer);
    this.findDefaultAsset = this.fallback.findDefaultAsset.bind(this.fallback);
  }

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    if (
      paymentRequirements.extra?.authorizationType !==
      "ReceiveWithAuthorization"
    ) {
      return this.fallback.createPaymentPayload(
        x402Version,
        paymentRequirements,
        context,
      );
    }
    const extraName = paymentRequirements.extra?.name;
    const extraVersion = paymentRequirements.extra?.version;
    if (typeof extraName !== "string" || typeof extraVersion !== "string") {
      throw new Error(
        "Payment challenge is missing FACET USD domain metadata.",
      );
    }
    const chainId = Number(paymentRequirements.network.split(":")[1]);
    const nonce = createRandomBytes32Hex();
    const now = Math.floor(Date.now() / 1000);
    const authorization = {
      from: getAddress(this.signer.address),
      to: getAddress(paymentRequirements.payTo),
      value: paymentRequirements.amount,
      validAfter: "0",
      validBefore: String(now + paymentRequirements.maxTimeoutSeconds),
      nonce,
    };
    const signature = await this.signer.signTypedData({
      domain: {
        name: extraName,
        version: extraVersion,
        chainId,
        verifyingContract: getAddress(paymentRequirements.asset),
      },
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: "ReceiveWithAuthorization",
      message: {
        from: authorization.from,
        to: authorization.to,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce,
      },
    });
    return {
      x402Version,
      payload: { authorization, signature },
    };
  }
}

export async function signBrowserX402Payment(params: {
  ethereum?: Eip1193Provider;
  address: Hex;
  required: PaymentRequired;
  pricingModel?: PricingModel;
  expectedAmountAtomic?: string;
  expectedProviderPayTo?: string;
}): Promise<{ paymentSignature: string; selected: PaymentRequirements }> {
  const provider = requireEthereum(params.ethereum);
  const address = getAddress(params.address);
  const selected = selectPaymentRequirement(
    params.required,
    params.pricingModel,
    params.expectedAmountAtomic,
    params.expectedProviderPayTo,
  );

  const walletClient = createWalletClient({
    account: address,
    chain: AVALANCHE_TESTNET_CHAIN,
    transport: custom(provider),
  });

  const signer: ClientEvmSigner = {
    address,
    signTypedData: async (typedData) =>
      walletClient.signTypedData({
        account: address,
        domain: typedData.domain as Record<string, unknown>,
        types: typedData.types as Record<
          string,
          readonly { name: string; type: string }[]
        >,
        primaryType: typedData.primaryType,
        message: typedData.message,
      }),
  };

  const client = x402Client.fromConfig({
    schemes: [
      {
        network: AVALANCHE_NETWORK,
        client: new ReceiveAuthorizationEvmScheme(signer),
      },
    ],
    spendControls: {
      allowedAssets: [
        {
          network: AVALANCHE_NETWORK,
          asset: FUSD_ASSET_ADDRESS,
          maxAmountPerPayment: selected.amount,
        },
      ],
    },
  });

  const singleOptionRequired: PaymentRequired = {
    ...params.required,
    accepts: [selected],
  };

  const payload = await client.createPaymentPayload(singleOptionRequired);
  const paymentSignature = encodePaymentSignatureHeader(payload);
  return { paymentSignature, selected };
}

export interface BrowserEscrowStateSnapshot {
  runId: string;
  runKey: Hex;
  contractAddress: Address;
  state: BrowserEscrowRunState;
  payer: Address;
  creatorPayTo: Address;
  unitPriceAtomic: string;
  maxAmountAtomic: string;
  expiresAtUnix: number;
  expiresAtIso: string;
  expired: boolean;
}

export interface BrowserEscrowReclaimResult {
  runId: string;
  runKey: Hex;
  contractAddress: Address;
  txHash: Hex;
  payer: Address;
  refundAmountAtomic: string;
}

type RawEscrowRead = {
  state: BrowserEscrowRunState;
  payer: Address;
  creatorPayTo: Address;
  unitPriceAtomic: string;
  maxAmountAtomic: string;
  expiresAtUnix: number;
};

export async function readBrowserEscrowState(
  runId: string,
  options?: {
    rpcUrl?: string;
    contractAddress?: Address;
    readState?: (runKey: Hex) => Promise<RawEscrowRead>;
  },
): Promise<BrowserEscrowStateSnapshot> {
  const trimmed = runId.trim();
  if (!trimmed) {
    throw new Error("Run ID is required to inspect an Avalanche escrow.");
  }
  const contractAddress = getAddress(
    options?.contractAddress ?? FUJI_CONTRACTS.feeSplitAndEscrow,
  );
  const runKey = keccak256(stringToHex(trimmed));
  let raw: RawEscrowRead;
  if (options?.readState) {
    raw = await options.readState(runKey);
  } else {
    const publicClient = createPublicClient({
      chain: AVALANCHE_TESTNET_CHAIN,
      transport: http(options?.rpcUrl ?? AVALANCHE_RPC_URL),
    });
    const [rawState, tuple] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: ESCROW_V2_ABI,
        functionName: "runState",
        args: [runKey],
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: ESCROW_V2_ABI,
        functionName: "escrows",
        args: [runKey],
      }),
    ]);
    raw = {
      state: RUN_STATE_NAMES[Number(rawState)] ?? "UNUSED",
      payer: tuple[1],
      creatorPayTo: tuple[2],
      unitPriceAtomic: tuple[3].toString(),
      maxAmountAtomic: tuple[4].toString(),
      expiresAtUnix: Number(tuple[5]),
    };
  }
  const nowUnix = Math.floor(Date.now() / 1000);
  return {
    runId: trimmed,
    runKey,
    contractAddress,
    state: raw.state,
    payer: raw.payer,
    creatorPayTo: raw.creatorPayTo,
    unitPriceAtomic: raw.unitPriceAtomic,
    maxAmountAtomic: raw.maxAmountAtomic,
    expiresAtUnix: raw.expiresAtUnix,
    expiresAtIso:
      raw.expiresAtUnix > 0
        ? new Date(raw.expiresAtUnix * 1000).toISOString()
        : "",
    expired:
      raw.state === "ESCROWED" &&
      raw.expiresAtUnix > 0 &&
      nowUnix >= raw.expiresAtUnix,
  };
}

export async function reclaimExpiredEscrowInBrowser(params: {
  ethereum?: Eip1193Provider;
  address: Hex;
  runId: string;
  rpcUrl?: string;
  contractAddress?: Address;
  readState?: (runKey: Hex) => Promise<RawEscrowRead>;
  submitRefund?: (runKey: Hex) => Promise<Hex>;
}): Promise<BrowserEscrowReclaimResult> {
  const provider = requireEthereum(params.ethereum);
  await ensureAvalancheChain(provider);
  const snapshot = await readBrowserEscrowState(params.runId, {
    ...(params.rpcUrl ? { rpcUrl: params.rpcUrl } : {}),
    ...(params.contractAddress
      ? { contractAddress: params.contractAddress }
      : {}),
    ...(params.readState ? { readState: params.readState } : {}),
  });
  if (snapshot.state !== "ESCROWED") {
    throw new Error(
      `Escrow for run ${snapshot.runId} is not active (state: ${snapshot.state}).`,
    );
  }
  if (!snapshot.expired) {
    throw new Error(
      `Escrow for run ${snapshot.runId} has not expired yet (expires at ${snapshot.expiresAtIso}).`,
    );
  }
  let txHash: Hex;
  if (params.submitRefund) {
    txHash = await params.submitRefund(snapshot.runKey);
  } else {
    const account = getAddress(params.address);
    const walletClient = createWalletClient({
      account,
      chain: AVALANCHE_TESTNET_CHAIN,
      transport: custom(provider),
    });
    txHash = await walletClient.writeContract({
      account,
      chain: AVALANCHE_TESTNET_CHAIN,
      address: snapshot.contractAddress,
      abi: ESCROW_V2_ABI,
      functionName: "refundEscrow",
      args: [snapshot.runKey],
    });
  }
  return {
    runId: snapshot.runId,
    runKey: snapshot.runKey,
    contractAddress: snapshot.contractAddress,
    txHash,
    payer: snapshot.payer,
    refundAmountAtomic: snapshot.maxAmountAtomic,
  };
}
