"use client";

import { decodePaymentRequiredHeader } from "@x402/core/http";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { getAddress, isAddress, type Hex } from "viem";

import {
  AVALANCHE_CHAIN_ID,
  FUSD_ASSET_ADDRESS,
  connectBrowserWallet,
  ensureAvalancheChain,
  getBrowserEthereumProvider,
  readBrowserEscrowState,
  readFusdBalanceAtomic,
  reclaimExpiredEscrowInBrowser,
  signBrowserX402Payment,
  type BrowserEscrowStateSnapshot,
} from "@/lib/browser-x402";
import {
  formatAtomicFusd,
  snowtraceTxUrl,
  truncateMiddle,
} from "@/lib/facet-ui";
import type { PricingModel } from "@/lib/identifiers";
import {
  normalizePricingOptions,
  type NormalizedPricingOption,
} from "@/lib/pricing-types";
import type { PublicFacet } from "@/lib/public-catalog";

interface SchemaProperty {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  description?: string;
  properties?: Record<string, SchemaProperty>;
}

interface InvokeSuccessPayload {
  runId: string;
  provider: string;
  facetName: string;
  facetDisplayName?: string;
  version: string;
  facetType?: string;
  result: unknown;
  dataset?: Record<string, unknown>[];
  usage?: {
    itemCount: number;
    durationMs: number;
    outputHash: string;
    runnerSignature: string;
  };
  replayed: boolean;
  payment?: {
    transaction: string;
    network: string;
    pricingModel?: PricingModel;
    amountAtomic?: string;
    unitPriceAtomic?: string;
    maxItemsCap?: number;
    depositedAmountAtomic?: string;
    refundAmountAtomic?: string;
    depositTxHash?: string;
    payer?: string;
    providerPayTo?: string;
    payTo?: string;
  };
  receipt?: {
    inputHash: string;
    outputHash: string;
    itemCount: number;
    paymentTxHash: string;
    receiptTxHash?: string;
    runnerSignature: string;
  };
}

interface PendingPayload {
  runId?: string;
  payment?: {
    status?: string;
    transaction?: string;
    depositTxHash?: string;
    escrowExpiresAt?: string;
  };
}

interface PendingEscrowRecord {
  runId: string;
  escrowExpiresAt?: string;
  depositTxHash?: string;
  savedAt: string;
}

const PENDING_ESCROW_STORAGE_KEY = "facet:pending-escrows:v1";

function loadPendingEscrows(): PendingEscrowRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_ESCROW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingEscrowRecord =>
        isRecord(item) &&
        typeof item.runId === "string" &&
        item.runId.length > 0,
    );
  } catch {
    return [];
  }
}

function writePendingEscrows(records: PendingEscrowRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PENDING_ESCROW_STORAGE_KEY,
      JSON.stringify(records.slice(0, 12)),
    );
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}

function savePendingEscrow(record: PendingEscrowRecord): PendingEscrowRecord[] {
  const existing = loadPendingEscrows().filter(
    (item) => item.runId !== record.runId,
  );
  const next = [record, ...existing].slice(0, 12);
  writePendingEscrows(next);
  return next;
}

function removePendingEscrow(runId: string): PendingEscrowRecord[] {
  const next = loadPendingEscrows().filter((item) => item.runId !== runId);
  writePendingEscrows(next);
  return next;
}

function formatEscrowCountdown(
  expiresAtIso: string | undefined,
  nowMs: number,
): { expired: boolean; label: string } {
  if (!expiresAtIso) {
    return { expired: false, label: "Waiting for 15-minute deadline" };
  }
  const expiresMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresMs)) {
    return { expired: false, label: `Deadline ${expiresAtIso}` };
  }
  const remainingSec = Math.ceil((expiresMs - nowMs) / 1000);
  if (remainingSec <= 0) {
    return {
      expired: true,
      label: "Escrow timeout reached — permissionless reclaim unlocked",
    };
  }
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return {
    expired: false,
    label: `Self-reclaim unlocks in ${mins}m ${String(secs).padStart(2, "0")}s`,
  };
}

interface RefundedErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
  runId?: string;
  payment?: {
    status?: string;
    transaction?: string;
    refundAmountAtomic?: string;
  };
}

const MAX_SETTLEMENT_POLLS = 15;

function subscribeNoop(): () => void {
  return () => {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildInitialInput(schema: unknown): Record<string, unknown> {
  if (!isRecord(schema) || !isRecord(schema.properties)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, rawProp] of Object.entries(schema.properties)) {
    if (!isRecord(rawProp)) continue;
    const prop = rawProp as SchemaProperty;
    if (prop.type === "object" && isRecord(prop.properties)) {
      result[key] = buildInitialInput(prop);
    } else if (prop.type === "array") {
      result[key] = Array.isArray(prop.default) ? prop.default : [];
    } else if (prop.default !== undefined) {
      result[key] = prop.default;
    } else if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      result[key] = prop.enum[0];
    } else if (prop.type === "integer" || prop.type === "number") {
      result[key] = 1;
    } else if (prop.type === "boolean") {
      result[key] = false;
    } else {
      result[key] = "";
    }
  }
  return result;
}

function flattenSchemaFields(
  schema: unknown,
  prefix: string[] = [],
): Array<{
  path: string[];
  label: string;
  prop: SchemaProperty;
}> {
  if (!isRecord(schema) || !isRecord(schema.properties)) return [];
  const fields: Array<{ path: string[]; label: string; prop: SchemaProperty }> =
    [];
  for (const [key, rawProp] of Object.entries(schema.properties)) {
    if (!isRecord(rawProp)) continue;
    const prop = rawProp as SchemaProperty;
    if (prop.type === "object" && isRecord(prop.properties)) {
      fields.push(...flattenSchemaFields(prop, [...prefix, key]));
    } else {
      fields.push({
        path: [...prefix, key],
        label: [...prefix, key].join("."),
        prop,
      });
    }
  }
  return fields;
}

function buildInitialArrayText(
  schema: unknown,
  initialInput: Record<string, unknown>,
): Record<string, string> {
  const fields = flattenSchemaFields(schema);
  const map: Record<string, string> = {};
  for (const field of fields) {
    if (field.prop.type === "array") {
      const value = getAtPath(initialInput, field.path);
      map[field.label] = JSON.stringify(
        Array.isArray(value) ? value : [],
        null,
        2,
      );
    }
  }
  return map;
}

function getAtPath(obj: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = obj;
  for (const segment of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (!head) return obj;
  if (rest.length === 0) {
    return { ...obj, [head]: value };
  }
  const child = isRecord(obj[head])
    ? (obj[head] as Record<string, unknown>)
    : {};
  return { ...obj, [head]: setAtPath(child, rest, value) };
}

function extractDatasetRows(
  response: InvokeSuccessPayload | null,
): Record<string, unknown>[] {
  if (!response) return [];
  if (Array.isArray(response.dataset)) {
    return response.dataset.filter(isRecord);
  }
  if (Array.isArray(response.result)) {
    return response.result.filter(isRecord);
  }
  if (isRecord(response.result) && Array.isArray(response.result.items)) {
    return response.result.items.filter(isRecord);
  }
  if (isRecord(response.result)) {
    return [response.result];
  }
  return [];
}

function resolvePlaygroundOptions(
  facet: PublicFacet,
): NormalizedPricingOption[] {
  const normalized = normalizePricingOptions(
    facet.pricing,
    facet.pricingOptions,
  );
  if (
    (!facet.pricingOptions || facet.pricingOptions.length === 0) &&
    facet.pricing?.model === "PAY_PER_RESULT" &&
    normalized[0]
  ) {
    const cap = facet.pricing.maxItemsCap ?? 20;
    const maxAmount =
      facet.pricing.maxAmountAtomic ??
      (BigInt(facet.pricing.priceAtomic) * BigInt(cap)).toString();
    return [
      {
        ...normalized[0],
        maxItemsCap: cap,
        maxAmountAtomic: maxAmount,
      },
    ];
  }
  if (normalized.length > 0) {
    return normalized;
  }
  return [
    {
      model: "PAY_PER_RUN",
      priceAtomic: "1000",
      maxAmountAtomic: "1000",
      assetAddress: FUSD_ASSET_ADDRESS,
      chainId: AVALANCHE_CHAIN_ID,
      payTo: "",
      isPrimary: true,
    },
  ];
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return 2000;
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds) || seconds <= 0) return 2000;
  return Math.min(Math.max(Math.round(seconds * 1000), 1500), 4000);
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function waitMs(
  durationMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, durationMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type PaidInvocationPollResult =
  | { kind: "success"; payload: InvokeSuccessPayload }
  | { kind: "refunded"; payload: RefundedErrorPayload }
  | { kind: "timeout"; pending: PendingPayload | null };

export async function pollPaidInvocation(params: {
  requestBody: string;
  idempotencyKey: string;
  paymentSignature: string;
  signal: AbortSignal;
  maxPolls?: number;
  fetchImpl?: typeof fetch;
  waitImpl?: (durationMs: number, signal?: AbortSignal) => Promise<void>;
  onPending?: (pending: PendingPayload | null) => void;
}): Promise<PaidInvocationPollResult> {
  const maxPolls = params.maxPolls ?? MAX_SETTLEMENT_POLLS;
  const fetchFn = params.fetchImpl ?? fetch;
  const waitFn = params.waitImpl ?? waitMs;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (params.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const paidResponse = await fetchFn("/api/facet/invoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": params.idempotencyKey,
        "payment-signature": params.paymentSignature,
      },
      body: params.requestBody,
      signal: params.signal,
    });

    if (paidResponse.status === 202) {
      const pending = (await paidResponse
        .json()
        .catch(() => null)) as PendingPayload | null;
      if (params.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      params.onPending?.(pending);
      if (attempt + 1 >= maxPolls) {
        return { kind: "timeout", pending };
      }
      await waitFn(
        parseRetryAfterMs(paidResponse.headers.get("retry-after")),
        params.signal,
      );
      continue;
    }

    if (paidResponse.status === 502) {
      const refunded = (await paidResponse
        .json()
        .catch(() => null)) as RefundedErrorPayload | null;
      if (refunded?.payment?.status === "refunded") {
        return { kind: "refunded", payload: refunded };
      }
      throw new Error(
        refunded?.error?.message ??
          refunded?.error?.code ??
          "Execution failed (HTTP 502).",
      );
    }

    const body = (await paidResponse.json().catch(() => null)) as
      | (InvokeSuccessPayload & {
          error?: { code?: string; message?: string };
        })
      | null;

    if (!paidResponse.ok || !body || !body.runId) {
      throw new Error(
        body?.error?.message ??
          body?.error?.code ??
          `Execution failed (HTTP ${paidResponse.status}).`,
      );
    }

    return { kind: "success", payload: body };
  }

  return { kind: "timeout", pending: null };
}

export interface AccountsChangedCoordinator {
  readBalance: (address: Hex) => Promise<string>;
  isMounted: () => boolean;
  nextRequestId: () => number;
  getRequestId: () => number;
  setActiveAddress: (address: Hex | null) => void;
  getActiveAddress: () => Hex | null;
  onDisconnected: () => void;
  onAccountSelected: (address: Hex) => void;
  onBalanceLoaded: (balanceAtomic: string) => void;
  onBalanceError: (message: string) => void;
}

export function createAccountsChangedHandler(
  coord: AccountsChangedCoordinator,
): (accounts: unknown) => Promise<void> {
  return async (accounts: unknown) => {
    const requestId = coord.nextRequestId();
    if (
      !Array.isArray(accounts) ||
      typeof accounts[0] !== "string" ||
      !isAddress(accounts[0])
    ) {
      coord.setActiveAddress(null);
      if (coord.isMounted()) {
        coord.onDisconnected();
      }
      return;
    }

    const next = getAddress(accounts[0]);
    coord.setActiveAddress(next);
    if (coord.isMounted()) {
      coord.onAccountSelected(next);
    }

    try {
      const balance = await coord.readBalance(next);
      if (
        coord.isMounted() &&
        coord.getRequestId() === requestId &&
        coord.getActiveAddress() === next
      ) {
        coord.onBalanceLoaded(balance);
      }
    } catch (cause) {
      if (
        coord.isMounted() &&
        coord.getRequestId() === requestId &&
        coord.getActiveAddress() === next
      ) {
        coord.onBalanceError(
          cause instanceof Error
            ? cause.message
            : "Unable to read fUSD balance on Avalanche.",
        );
      }
    }
  };
}

export function FacetPlayground({ facet }: { facet: PublicFacet }) {
  const fields = flattenSchemaFields(facet.inputSchema);
  const pricingOptions = resolvePlaygroundOptions(facet);
  const defaultOption =
    pricingOptions.find((option) => option.isPrimary) ?? pricingOptions[0]!;

  const hasInjectedWallet = useSyncExternalStore(
    subscribeNoop,
    () => Boolean(getBrowserEthereumProvider()),
    () => false,
  );

  const [selectedPricingModel, setSelectedPricingModel] =
    useState<PricingModel>(defaultOption.model);
  const selectedOption =
    pricingOptions.find((option) => option.model === selectedPricingModel) ??
    defaultOption;

  const [walletAddress, setWalletAddress] = useState<Hex | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [fusdBalanceAtomic, setFusdBalanceAtomic] = useState<string | null>(
    null,
  );
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [formValue, setFormValue] = useState<Record<string, unknown>>(() =>
    buildInitialInput(facet.inputSchema),
  );
  const [arrayFieldText, setArrayFieldText] = useState<Record<string, string>>(
    () =>
      buildInitialArrayText(
        facet.inputSchema,
        buildInitialInput(facet.inputSchema),
      ),
  );
  const [rawMode, setRawMode] = useState(fields.length === 0);
  const [rawJson, setRawJson] = useState(() =>
    JSON.stringify(buildInitialInput(facet.inputSchema), null, 2),
  );
  const [running, setRunning] = useState(false);
  const [pendingState, setPendingState] = useState<{
    runId?: string;
    status: string;
    transaction?: string;
    escrowExpiresAt?: string;
  } | null>(null);
  const [pendingEscrows, setPendingEscrows] = useState<PendingEscrowRecord[]>(
    [],
  );
  const [recoveryRunId, setRecoveryRunId] = useState("");
  const [escrowBusy, setEscrowBusy] = useState(false);
  const [escrowSnapshot, setEscrowSnapshot] =
    useState<BrowserEscrowStateSnapshot | null>(null);
  const [escrowReclaimTxHash, setEscrowReclaimTxHash] = useState<string | null>(
    null,
  );
  const [escrowRecoveryError, setEscrowRecoveryError] = useState<string | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refundedError, setRefundedError] = useState<{
    code: string;
    message?: string;
    runId?: string;
    transaction?: string;
    refundAmountAtomic?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<InvokeSuccessPayload | null>(null);
  const [viewTab, setViewTab] = useState<"dataset" | "json">("dataset");

  const mountedRef = useRef(true);
  const runAbortRef = useRef<AbortController | null>(null);
  const balanceRequestIdRef = useRef(0);
  const activeAddressRef = useRef<Hex | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const saved = loadPendingEscrows();
    if (saved.length > 0) {
      setPendingEscrows(saved);
      setRecoveryRunId((prev) => prev || saved[0]!.runId);
    }
    return () => {
      mountedRef.current = false;
      balanceRequestIdRef.current += 1;
      runAbortRef.current?.abort();
      runAbortRef.current = null;
    };
  }, []);

  const hasActiveCountdown = Boolean(
    pendingState?.escrowExpiresAt ||
    escrowSnapshot?.state === "ESCROWED" ||
    pendingEscrows.some((item) => Boolean(item.escrowExpiresAt)),
  );

  useEffect(() => {
    if (!hasActiveCountdown) return;
    setNowMs(Date.now());
    const timer = globalThis.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [hasActiveCountdown]);

  async function syncWalletBalance(
    address: Hex,
    options?: { surfaceError?: boolean },
  ): Promise<void> {
    const requestId = ++balanceRequestIdRef.current;
    activeAddressRef.current = address;
    try {
      const balance = await readFusdBalanceAtomic(address);
      if (
        !mountedRef.current ||
        balanceRequestIdRef.current !== requestId ||
        activeAddressRef.current !== address
      ) {
        return;
      }
      setFusdBalanceAtomic(balance);
      if (options?.surfaceError) {
        setWalletError(null);
      }
    } catch (cause) {
      if (
        !mountedRef.current ||
        balanceRequestIdRef.current !== requestId ||
        activeAddressRef.current !== address
      ) {
        return;
      }
      if (options?.surfaceError) {
        setWalletError(
          cause instanceof Error
            ? cause.message
            : "Unable to read fUSD balance on Avalanche.",
        );
      }
    }
  }

  useEffect(() => {
    const ethereum = getBrowserEthereumProvider();
    if (!ethereum?.on || !ethereum?.removeListener || !walletAddress) return;

    const handleAccountsChanged = createAccountsChangedHandler({
      readBalance: readFusdBalanceAtomic,
      isMounted: () => mountedRef.current,
      nextRequestId: () => ++balanceRequestIdRef.current,
      getRequestId: () => balanceRequestIdRef.current,
      setActiveAddress: (address) => {
        activeAddressRef.current = address;
      },
      getActiveAddress: () => activeAddressRef.current,
      onDisconnected: () => {
        setWalletAddress(null);
        setFusdBalanceAtomic(null);
        setWalletError(null);
      },
      onAccountSelected: (next) => {
        setWalletAddress(next);
        setFusdBalanceAtomic(null);
        setWalletError(null);
      },
      onBalanceLoaded: (balance) => {
        setFusdBalanceAtomic(balance);
      },
      onBalanceError: (message) => {
        setWalletError(message);
      },
    });

    const handleChainChanged = (rawChainId: unknown) => {
      if (!mountedRef.current) return;
      if (typeof rawChainId === "string" && rawChainId.startsWith("0x")) {
        setWalletChainId(Number.parseInt(rawChainId, 16));
      } else if (typeof rawChainId === "number") {
        setWalletChainId(rawChainId);
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [walletAddress]);

  async function refreshWalletBalance(address: Hex) {
    setWalletBusy(true);
    try {
      await syncWalletBalance(address, { surfaceError: true });
    } finally {
      if (mountedRef.current) {
        setWalletBusy(false);
      }
    }
  }

  async function handleConnectWallet() {
    setWalletError(null);
    setError(null);
    setWalletBusy(true);
    try {
      const connected = await connectBrowserWallet();
      await ensureAvalancheChain();
      if (!mountedRef.current) return;
      activeAddressRef.current = connected.address;
      setWalletAddress(connected.address);
      setWalletChainId(AVALANCHE_CHAIN_ID);
      setFusdBalanceAtomic(null);
      await syncWalletBalance(connected.address, { surfaceError: true });
    } catch (cause) {
      if (!mountedRef.current) return;
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "Wallet connection was canceled or unavailable.",
      );
    } finally {
      if (mountedRef.current) {
        setWalletBusy(false);
      }
    }
  }

  async function handleSwitchAvalanche() {
    setWalletError(null);
    setWalletBusy(true);
    try {
      await ensureAvalancheChain();
      if (!mountedRef.current) return;
      setWalletChainId(AVALANCHE_CHAIN_ID);
      const currentAddress = activeAddressRef.current ?? walletAddress;
      if (currentAddress) {
        await syncWalletBalance(currentAddress, { surfaceError: true });
      }
    } catch (cause) {
      if (!mountedRef.current) return;
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "Could not switch wallet network to Avalanche.",
      );
    } finally {
      if (mountedRef.current) {
        setWalletBusy(false);
      }
    }
  }

  async function handleCheckEscrowStatus(runIdOverride?: string) {
    const targetRunId = (runIdOverride ?? recoveryRunId).trim();
    if (!targetRunId) {
      setEscrowRecoveryError(
        "Enter a Run ID to inspect its on-chain escrow status.",
      );
      return;
    }
    setEscrowBusy(true);
    setEscrowRecoveryError(null);
    try {
      const snapshot = await readBrowserEscrowState(targetRunId);
      if (!mountedRef.current) return;
      setRecoveryRunId(targetRunId);
      setEscrowSnapshot(snapshot);
    } catch (cause) {
      if (!mountedRef.current) return;
      setEscrowRecoveryError(
        cause instanceof Error
          ? cause.message
          : "Could not read escrow status from Avalanche.",
      );
    } finally {
      if (mountedRef.current) {
        setEscrowBusy(false);
      }
    }
  }

  async function handleReclaimEscrow(runIdOverride?: string) {
    const targetRunId = (runIdOverride ?? recoveryRunId).trim();
    if (!targetRunId) {
      setEscrowRecoveryError(
        "Enter a Run ID to reclaim its expired escrow on Avalanche.",
      );
      return;
    }
    setEscrowBusy(true);
    setEscrowRecoveryError(null);
    setEscrowReclaimTxHash(null);
    try {
      let address = activeAddressRef.current ?? walletAddress;
      if (!address) {
        const connected = await connectBrowserWallet();
        if (!mountedRef.current) return;
        address = connected.address;
        activeAddressRef.current = connected.address;
        setWalletAddress(connected.address);
      }
      await ensureAvalancheChain();
      if (!mountedRef.current) return;
      setWalletChainId(AVALANCHE_CHAIN_ID);

      const result = await reclaimExpiredEscrowInBrowser({
        address,
        runId: targetRunId,
      });
      if (!mountedRef.current) return;
      setRecoveryRunId(targetRunId);
      setEscrowReclaimTxHash(result.txHash);
      setPendingEscrows(removePendingEscrow(targetRunId));
      if (pendingState?.runId === targetRunId) {
        setPendingState(null);
      }
      try {
        const updated = await readBrowserEscrowState(targetRunId);
        if (mountedRef.current) {
          setEscrowSnapshot(updated);
        }
      } catch {
        // Non-fatal if immediate post-tx RPC read lags behind
      }
      void syncWalletBalance(address);
    } catch (cause) {
      if (!mountedRef.current) return;
      setEscrowRecoveryError(
        cause instanceof Error
          ? cause.message
          : "Failed to submit escrow reclaim transaction on Avalanche.",
      );
    } finally {
      if (mountedRef.current) {
        setEscrowBusy(false);
      }
    }
  }

  const hasInsufficientBalance =
    walletAddress !== null &&
    fusdBalanceAtomic !== null &&
    BigInt(fusdBalanceAtomic) < BigInt(selectedOption.maxAmountAtomic);

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRefundedError(null);
    setPendingState(null);

    if (!walletAddress) {
      setError(
        "Connect an EVM wallet on Avalanche before executing this Facet.",
      );
      return;
    }

    let inputPayload: Record<string, unknown>;
    if (rawMode) {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        if (!isRecord(parsed)) {
          throw new Error("Input JSON must be an object.");
        }
        inputPayload = parsed;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON input.");
        return;
      }
    } else {
      let nextFormValue = formValue;
      for (const field of fields) {
        if (field.prop.type !== "array") continue;
        const text = arrayFieldText[field.label] ?? "[]";
        try {
          const parsed = JSON.parse(text) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error(`Field "${field.label}" must be a JSON array.`);
          }
          nextFormValue = setAtPath(nextFormValue, field.path, parsed);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : `Field "${field.label}" contains invalid JSON.`,
          );
          return;
        }
      }
      inputPayload = nextFormValue;
    }

    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;
    const { signal } = controller;

    setRunning(true);
    try {
      await ensureAvalancheChain();
      if (signal.aborted || !mountedRef.current) return;
      setWalletChainId(AVALANCHE_CHAIN_ID);

      const balanceReqId = ++balanceRequestIdRef.current;
      activeAddressRef.current = walletAddress;
      const latestBalance = await readFusdBalanceAtomic(walletAddress);
      if (signal.aborted || !mountedRef.current) return;
      if (
        balanceRequestIdRef.current === balanceReqId &&
        activeAddressRef.current === walletAddress
      ) {
        setFusdBalanceAtomic(latestBalance);
      }
      if (BigInt(latestBalance) < BigInt(selectedOption.maxAmountAtomic)) {
        setError(
          `Insufficient fUSD balance (${formatAtomicFusd(latestBalance)}) for required ${formatAtomicFusd(selectedOption.maxAmountAtomic)}. Claim test fUSD in the Faucet first.`,
        );
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      const requestBody = JSON.stringify({
        provider: facet.provider,
        facetName: facet.facetName,
        version: facet.version,
        input: inputPayload,
        pricingModel: selectedOption.model,
      });

      const challengeResponse = await fetch("/api/facet/invoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: requestBody,
        signal,
      });
      if (signal.aborted || !mountedRef.current) return;

      if (challengeResponse.status === 200) {
        const immediate =
          (await challengeResponse.json()) as InvokeSuccessPayload;
        if (signal.aborted || !mountedRef.current) return;
        setOutput(immediate);
        setViewTab("dataset");
        void syncWalletBalance(walletAddress);
        return;
      }

      if (challengeResponse.status !== 402) {
        const errBody = (await challengeResponse.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        throw new Error(
          errBody?.error?.message ??
            errBody?.error?.code ??
            `Gateway rejected request (HTTP ${challengeResponse.status}).`,
        );
      }

      const challengeHeader = challengeResponse.headers.get("payment-required");
      if (!challengeHeader) {
        throw new Error(
          "Gateway returned 402 without a PAYMENT-REQUIRED header.",
        );
      }

      const hasCatalogPricing =
        Boolean(facet.pricing) ||
        Boolean(facet.pricingOptions && facet.pricingOptions.length > 0);
      const required = decodePaymentRequiredHeader(challengeHeader);
      const { paymentSignature } = await signBrowserX402Payment({
        address: walletAddress,
        required,
        pricingModel: selectedOption.model,
        ...(hasCatalogPricing
          ? { expectedAmountAtomic: selectedOption.maxAmountAtomic }
          : {}),
        ...(selectedOption.payTo
          ? { expectedProviderPayTo: selectedOption.payTo }
          : {}),
      });
      if (signal.aborted || !mountedRef.current) return;

      const pollOutcome = await pollPaidInvocation({
        requestBody,
        idempotencyKey,
        paymentSignature,
        signal,
        onPending: (pending) => {
          if (signal.aborted || !mountedRef.current) return;
          if (
            pending?.runId &&
            (pending.payment?.escrowExpiresAt ||
              pending.payment?.status === "escrow_pending")
          ) {
            setRecoveryRunId(pending.runId);
            setPendingEscrows(
              savePendingEscrow({
                runId: pending.runId,
                ...(pending.payment?.escrowExpiresAt
                  ? { escrowExpiresAt: pending.payment.escrowExpiresAt }
                  : {}),
                ...((pending.payment?.depositTxHash ??
                pending.payment?.transaction)
                  ? {
                      depositTxHash:
                        pending.payment?.depositTxHash ??
                        pending.payment?.transaction,
                    }
                  : {}),
                savedAt: new Date().toISOString(),
              }),
            );
          }
          setPendingState({
            ...(pending?.runId ? { runId: pending.runId } : {}),
            status: pending?.payment?.status ?? "settlement_pending",
            ...(pending?.payment?.transaction
              ? { transaction: pending.payment.transaction }
              : {}),
            ...(pending?.payment?.escrowExpiresAt
              ? { escrowExpiresAt: pending.payment.escrowExpiresAt }
              : {}),
          });
        },
      });
      if (signal.aborted || !mountedRef.current) return;

      if (pollOutcome.kind === "timeout") {
        setError(
          `Settlement is still confirming on Avalanche${pollOutcome.pending?.runId ? ` (runId: ${pollOutcome.pending.runId})` : ""}. Wait a moment and retry, or check Escrow Recovery below after the 15-minute deadline.`,
        );
        return;
      }

      if (pollOutcome.kind === "refunded") {
        const refunded = pollOutcome.payload;
        if (refunded.runId) {
          setPendingEscrows(removePendingEscrow(refunded.runId));
        }
        setPendingState(null);
        setRefundedError({
          code: refunded.error?.code ?? "EXECUTION_FAILED",
          ...(refunded.error?.message
            ? { message: refunded.error.message }
            : {}),
          ...(refunded.runId ? { runId: refunded.runId } : {}),
          ...(refunded.payment?.transaction
            ? { transaction: refunded.payment.transaction }
            : {}),
          ...(refunded.payment?.refundAmountAtomic
            ? { refundAmountAtomic: refunded.payment.refundAmountAtomic }
            : {}),
        });
        void syncWalletBalance(walletAddress);
        return;
      }

      if (pollOutcome.payload.runId) {
        setPendingEscrows(removePendingEscrow(pollOutcome.payload.runId));
      }
      setPendingState(null);
      setOutput(pollOutcome.payload);
      setViewTab("dataset");
      void syncWalletBalance(walletAddress);
    } catch (err) {
      if (isAbortError(err) || signal.aborted || !mountedRef.current) return;
      setPendingState(null);
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
      }
      if (mountedRef.current && !signal.aborted) {
        setRunning(false);
      }
    }
  }

  const datasetRows = extractDatasetRows(output);
  const columns = Array.from(
    new Set(datasetRows.flatMap((row) => Object.keys(row))),
  );
  const isPayPerResultSelected = selectedOption.model === "PAY_PER_RESULT";
  const showEscrowBreakdown = Boolean(
    output?.payment &&
    (output.payment.pricingModel === "PAY_PER_RESULT" ||
      output.payment.depositedAmountAtomic !== undefined),
  );

  return (
    <section className="playground-section" aria-labelledby="playground-title">
      <div className="playground-header">
        <div>
          <p className="eyebrow">Interactive Runner &amp; x402 Checkout</p>
          <h2 id="playground-title">Input-Schema Form</h2>
        </div>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            if (!rawMode) {
              setRawJson(JSON.stringify(formValue, null, 2));
            } else {
              try {
                const parsed = JSON.parse(rawJson) as unknown;
                if (isRecord(parsed)) {
                  setFormValue(parsed);
                  setArrayFieldText(
                    buildInitialArrayText(facet.inputSchema, parsed),
                  );
                }
              } catch {
                // Keep existing formValue if raw JSON is incomplete
              }
            }
            setRawMode((prev) => !prev);
          }}
        >
          {rawMode ? "Switch to Schema Form" : "Switch to Raw JSON"}
        </button>
      </div>

      <div className="playground-wallet-bar" aria-label="Avalanche Wallet">
        <div className="playground-wallet-info">
          {walletAddress ? (
            <>
              <span className="playground-wallet-badge">
                {truncateMiddle(walletAddress)}
              </span>
              <span
                className={`playground-chain-pill ${walletChainId === AVALANCHE_CHAIN_ID ? "playground-chain-ok" : "playground-chain-warn"}`}
              >
                {walletChainId === AVALANCHE_CHAIN_ID
                  ? "Avalanche (43113)"
                  : `Wrong Network (${walletChainId ?? "unknown"})`}
              </span>
              <span className="playground-balance-pill">
                Balance:{" "}
                <strong>
                  {fusdBalanceAtomic !== null
                    ? formatAtomicFusd(fusdBalanceAtomic)
                    : "Checking…"}
                </strong>
              </span>
            </>
          ) : (
            <span className="playground-wallet-prompt">
              {hasInjectedWallet
                ? "Connect your EVM wallet on Avalanche to sign x402 fUSD payments directly."
                : "Connect an EVM browser wallet on Avalanche to sign x402 fUSD payments directly."}
            </span>
          )}
        </div>

        <div className="playground-wallet-actions">
          {!walletAddress ? (
            <button
              type="button"
              className="button button-secondary"
              disabled={walletBusy}
              onClick={() => void handleConnectWallet()}
            >
              {walletBusy ? "Connecting…" : "Connect Wallet"}
            </button>
          ) : (
            <>
              {walletChainId !== AVALANCHE_CHAIN_ID ? (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={walletBusy}
                  onClick={() => void handleSwitchAvalanche()}
                >
                  Switch to Avalanche
                </button>
              ) : null}
              <button
                type="button"
                className="preset-chip"
                disabled={walletBusy}
                onClick={() => void refreshWalletBalance(walletAddress)}
              >
                {walletBusy ? "Refreshing…" : "Refresh fUSD"}
              </button>
            </>
          )}
          <Link href="/faucet" className="playground-faucet-link">
            Get test fUSD ↗
          </Link>
        </div>
      </div>

      {walletError ? (
        <div className="error-banner" role="alert">
          <strong>Wallet notice</strong>
          <p>{walletError}</p>
        </div>
      ) : null}

      {hasInsufficientBalance ? (
        <div className="playground-balance-warning" role="alert">
          <div>
            <strong>Insufficient fUSD balance</strong>
            <p>
              This option requires{" "}
              {formatAtomicFusd(selectedOption.maxAmountAtomic)}, while your
              connected wallet holds{" "}
              {formatAtomicFusd(fusdBalanceAtomic ?? "0")}.
            </p>
          </div>
          <Link href="/faucet" className="button button-secondary">
            Claim test fUSD in Faucet ↗
          </Link>
        </div>
      ) : null}

      <form className="playground-form" onSubmit={handleRun}>
        {pricingOptions.length > 1 ? (
          <fieldset className="playground-pricing-selector">
            <legend>Payment Method</legend>
            <div className="playground-pricing-options">
              {pricingOptions.map((option) => {
                const isSelected = selectedOption.model === option.model;
                const cap = option.maxItemsCap ?? 20;
                return (
                  <label
                    key={option.model}
                    className={`playground-pricing-option ${isSelected ? "playground-pricing-option-active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="playground-pricing-model"
                      value={option.model}
                      checked={isSelected}
                      disabled={running}
                      onChange={() => setSelectedPricingModel(option.model)}
                    />
                    <span className="playground-pricing-copy">
                      <strong>
                        {option.model}
                        {option.isPrimary ? " · Primary" : ""}
                      </strong>
                      {option.model === "PAY_PER_RESULT" ? (
                        <small>
                          {formatAtomicFusd(option.priceAtomic)} / item · max{" "}
                          {cap} items (escrow deposit{" "}
                          {formatAtomicFusd(option.maxAmountAtomic)})
                        </small>
                      ) : (
                        <small>
                          {formatAtomicFusd(option.priceAtomic)} / run (fixed
                          x402 settlement)
                        </small>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <div className="playground-single-pricing">
            <span>Pricing Terms:</span>
            <strong>{selectedOption.model}</strong>
            {selectedOption.model === "PAY_PER_RESULT" ? (
              <span>
                {formatAtomicFusd(selectedOption.priceAtomic)} / item · max{" "}
                {selectedOption.maxItemsCap ?? 20} items (escrow deposit{" "}
                {formatAtomicFusd(selectedOption.maxAmountAtomic)})
              </span>
            ) : (
              <span>{formatAtomicFusd(selectedOption.priceAtomic)} / run</span>
            )}
          </div>
        )}

        {rawMode ? (
          <div className="form-field">
            <label htmlFor="playground-raw-json">Input JSON</label>
            <textarea
              id="playground-raw-json"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={8}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="playground-fields">
            {fields.map(({ path, label, prop }) => {
              const current = getAtPath(formValue, path);
              const inputId = `field-${label}`;
              if (Array.isArray(prop.enum) && prop.enum.length > 0) {
                return (
                  <div className="form-field" key={label}>
                    <label htmlFor={inputId}>{label}</label>
                    <select
                      id={inputId}
                      value={String(current ?? prop.enum[0])}
                      onChange={(e) =>
                        setFormValue((prev) =>
                          setAtPath(prev, path, e.target.value),
                        )
                      }
                    >
                      {prop.enum.map((opt) => (
                        <option key={String(opt)} value={String(opt)}>
                          {String(opt)}
                        </option>
                      ))}
                    </select>
                    {prop.description ? (
                      <small>{prop.description}</small>
                    ) : null}
                  </div>
                );
              }
              if (prop.type === "boolean") {
                return (
                  <div className="form-field" key={label}>
                    <label className="checkbox-label" htmlFor={inputId}>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={Boolean(current)}
                        onChange={(e) =>
                          setFormValue((prev) =>
                            setAtPath(prev, path, e.target.checked),
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                    {prop.description ? (
                      <small>{prop.description}</small>
                    ) : null}
                  </div>
                );
              }
              if (prop.type === "array") {
                const rawArrayText =
                  arrayFieldText[label] ??
                  JSON.stringify(
                    Array.isArray(current) ? current : [],
                    null,
                    2,
                  );
                return (
                  <div className="form-field form-field-wide" key={label}>
                    <label htmlFor={inputId}>{label} (JSON array)</label>
                    <textarea
                      id={inputId}
                      rows={5}
                      spellCheck={false}
                      value={rawArrayText}
                      onChange={(e) => {
                        const nextText = e.target.value;
                        setArrayFieldText((prev) => ({
                          ...prev,
                          [label]: nextText,
                        }));
                        try {
                          const parsed = JSON.parse(nextText) as unknown;
                          if (Array.isArray(parsed)) {
                            setFormValue((prev) =>
                              setAtPath(prev, path, parsed),
                            );
                          }
                        } catch {
                          // Allow incomplete JSON edits while typing; validated on Run
                        }
                      }}
                    />
                    {prop.description ? (
                      <small>{prop.description}</small>
                    ) : null}
                  </div>
                );
              }
              const isNumeric =
                prop.type === "integer" || prop.type === "number";
              return (
                <div className="form-field" key={label}>
                  <label htmlFor={inputId}>{label}</label>
                  <input
                    id={inputId}
                    type={isNumeric ? "number" : "text"}
                    value={String(current ?? "")}
                    onChange={(e) =>
                      setFormValue((prev) =>
                        setAtPath(
                          prev,
                          path,
                          isNumeric ? Number(e.target.value) : e.target.value,
                        ),
                      )
                    }
                  />
                  {prop.description ? <small>{prop.description}</small> : null}
                </div>
              );
            })}
          </div>
        )}

        {pendingState ? (
          <div className="playground-pending-banner" role="status">
            <strong>
              Confirming Avalanche settlement ({pendingState.status})
            </strong>
            <p>
              Reusing signed x402 authorization without re-prompting your wallet
              {pendingState.runId ? ` · Run ${pendingState.runId}` : ""}.
            </p>
            {pendingState.escrowExpiresAt
              ? (() => {
                  const countdown = formatEscrowCountdown(
                    pendingState.escrowExpiresAt,
                    nowMs,
                  );
                  return (
                    <p>
                      {countdown.label} ({pendingState.escrowExpiresAt})
                    </p>
                  );
                })()
              : null}
            {pendingState.runId &&
            pendingState.escrowExpiresAt &&
            formatEscrowCountdown(pendingState.escrowExpiresAt, nowMs)
              .expired ? (
              <div className="escrow-recovery-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={escrowBusy}
                  onClick={() => void handleReclaimEscrow(pendingState.runId)}
                >
                  {escrowBusy
                    ? "Reclaiming..."
                    : "Reclaim Expired Escrow on Avalanche"}
                </button>
              </div>
            ) : null}
            {pendingState.transaction ? (
              <a
                className="explorer-link"
                href={snowtraceTxUrl(pendingState.transaction)}
                target="_blank"
                rel="noreferrer"
              >
                Track transaction on Snowtrace ↗
              </a>
            ) : null}
          </div>
        ) : null}

        {refundedError ? (
          <div className="playground-refund-banner" role="alert">
            <strong>
              Execution failed — Escrow Refunded ({refundedError.code})
            </strong>
            <p>
              {refundedError.message ??
                "The Facet execution failed before completion, and your locked escrow deposit was refunded."}
            </p>
            <dl className="inspector-specs">
              {refundedError.runId ? (
                <div>
                  <dt>Run ID</dt>
                  <dd>{refundedError.runId}</dd>
                </div>
              ) : null}
              {refundedError.refundAmountAtomic ? (
                <div>
                  <dt>Refunded Amount</dt>
                  <dd>{formatAtomicFusd(refundedError.refundAmountAtomic)}</dd>
                </div>
              ) : null}
              {refundedError.transaction ? (
                <div>
                  <dt>Refund Tx (Avalanche)</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={snowtraceTxUrl(refundedError.transaction)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {refundedError.transaction} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {error ? (
          <div className="error-banner" role="alert">
            <strong>Execution failed</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          className="button button-primary"
          disabled={running || !walletAddress || hasInsufficientBalance}
        >
          {running
            ? "Signing & Executing on Avalanche…"
            : !walletAddress
              ? `Connect Wallet to Pay ${formatAtomicFusd(selectedOption.maxAmountAtomic)}`
              : isPayPerResultSelected
                ? `Deposit ${formatAtomicFusd(selectedOption.maxAmountAtomic)} Escrow & Run`
                : `Pay ${formatAtomicFusd(selectedOption.priceAtomic)} via x402 & Run`}
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      {output ? (
        <div className="run-output" aria-live="polite">
          <div className="run-output-header">
            <div>
              <p className="eyebrow">Run Completed</p>
              <h3>Dataset &amp; On-Chain Proof</h3>
            </div>
            <div className="studio-tabs">
              <button
                type="button"
                className={`tab-button ${viewTab === "dataset" ? "tab-active" : ""}`}
                onClick={() => setViewTab("dataset")}
              >
                Dataset Table ({datasetRows.length})
              </button>
              <button
                type="button"
                className={`tab-button ${viewTab === "json" ? "tab-active" : ""}`}
                onClick={() => setViewTab("json")}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {viewTab === "dataset" && datasetRows.length > 0 ? (
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      {columns.map((col) => {
                        const cell = row[col];
                        return (
                          <td key={col}>
                            {typeof cell === "object" && cell !== null
                              ? JSON.stringify(cell)
                              : String(cell ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="json-pre">{JSON.stringify(output, null, 2)}</pre>
          )}

          <div className="receipt-panel">
            <h4>Avalanche On-Chain Proof &amp; Receipt</h4>

            {showEscrowBreakdown && output.payment ? (
              <div className="escrow-receipt-breakdown">
                <div>
                  <span>Deposited</span>
                  <strong>
                    {formatAtomicFusd(
                      output.payment.depositedAmountAtomic ??
                        output.payment.amountAtomic,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Items Returned</span>
                  <strong>{output.usage?.itemCount ?? 0}</strong>
                </div>
                <div>
                  <span>Actual Paid</span>
                  <strong>
                    {formatAtomicFusd(output.payment.amountAtomic)}
                  </strong>
                </div>
                <div>
                  <span>Refunded</span>
                  <strong>
                    {formatAtomicFusd(output.payment.refundAmountAtomic ?? "0")}
                  </strong>
                </div>
              </div>
            ) : null}

            <dl className="receipt-grid">
              <div>
                <dt>Run ID</dt>
                <dd>{output.runId}</dd>
              </div>
              {output.payment?.pricingModel ? (
                <div>
                  <dt>Pricing Model</dt>
                  <dd>{output.payment.pricingModel}</dd>
                </div>
              ) : null}
              {output.usage ? (
                <>
                  <div>
                    <dt>Usage</dt>
                    <dd>
                      {output.usage.itemCount} items in{" "}
                      {output.usage.durationMs}
                      ms
                    </dd>
                  </div>
                  <div>
                    <dt>Output Hash</dt>
                    <dd>{output.usage.outputHash}</dd>
                  </div>
                  <div>
                    <dt>Runner Signature</dt>
                    <dd>{output.usage.runnerSignature}</dd>
                  </div>
                </>
              ) : null}
              {output.payment?.depositTxHash ? (
                <div>
                  <dt>Escrow Deposit Tx (Avalanche)</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={snowtraceTxUrl(output.payment.depositTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {output.payment.depositTxHash} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
              {output.payment?.transaction ? (
                <div>
                  <dt>x402 Settlement Tx (Avalanche)</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={snowtraceTxUrl(output.payment.transaction)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {output.payment.transaction} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
              {output.receipt?.receiptTxHash ? (
                <div>
                  <dt>On-Chain ReceiptLog Tx</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={snowtraceTxUrl(output.receipt.receiptTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {output.receipt.receiptTxHash} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}

      <details className="playground-escrow-recovery">
        <summary>
          Direct Avalanche Escrow Recovery (Zero-Backend Self-Reclaim)
        </summary>
        <div className="escrow-recovery-body">
          <p className="escrow-recovery-copy">
            Pay-per-result escrows enforce an on-chain 15-minute deadline. Once
            expired, anyone can call refund directly on Avalanche to return 100%
            of locked fUSD to the original payer even if FACET servers are
            unreachable.
          </p>

          {pendingEscrows.length > 0 ? (
            <div className="escrow-recovery-saved">
              <span>Saved pending escrows:</span>
              {pendingEscrows.map((entry) => (
                <button
                  key={entry.runId}
                  type="button"
                  className="escrow-recovery-chip"
                  onClick={() => {
                    setRecoveryRunId(entry.runId);
                    void handleCheckEscrowStatus(entry.runId);
                  }}
                >
                  {truncateMiddle(entry.runId, 16)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="escrow-recovery-controls">
            <label htmlFor="escrow-recovery-run-id">Run ID</label>
            <input
              id="escrow-recovery-run-id"
              className="playground-input"
              type="text"
              value={recoveryRunId}
              onChange={(event) => setRecoveryRunId(event.target.value)}
              placeholder="Enter run ID (e.g. run_...)"
            />
            <div className="escrow-recovery-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={escrowBusy}
                onClick={() => void handleCheckEscrowStatus()}
              >
                {escrowBusy ? "Checking..." : "Check Escrow Status"}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={escrowBusy}
                onClick={() => void handleReclaimEscrow()}
              >
                {escrowBusy
                  ? "Submitting..."
                  : "Reclaim Expired Escrow on Avalanche"}
              </button>
            </div>
          </div>

          {escrowRecoveryError ? (
            <div className="error-banner" role="alert">
              <p>{escrowRecoveryError}</p>
            </div>
          ) : null}

          {escrowReclaimTxHash ? (
            <div className="escrow-recovery-status" role="status">
              <strong>Escrow reclaim submitted on Avalanche</strong>
              <a
                className="explorer-link"
                href={snowtraceTxUrl(escrowReclaimTxHash)}
                target="_blank"
                rel="noreferrer"
              >
                View reclaim tx on Snowtrace ({escrowReclaimTxHash}) ↗
              </a>
            </div>
          ) : null}

          {escrowSnapshot ? (
            <div className="escrow-recovery-status">
              <dl className="inspector-specs">
                <div>
                  <dt>On-Chain Escrow State</dt>
                  <dd>{escrowSnapshot.state}</dd>
                </div>
                <div>
                  <dt>Locked Amount</dt>
                  <dd>{formatAtomicFusd(escrowSnapshot.maxAmountAtomic)}</dd>
                </div>
                <div>
                  <dt>Payer Address</dt>
                  <dd>{escrowSnapshot.payer}</dd>
                </div>
                <div>
                  <dt>Expiry Deadline</dt>
                  <dd>
                    {escrowSnapshot.expiresAtIso ?? "None"} (
                    {escrowSnapshot.expired
                      ? "Expired — reclaim unlocked"
                      : formatEscrowCountdown(
                          escrowSnapshot.expiresAtIso ?? undefined,
                          nowMs,
                        ).label}
                    )
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
