"use client";

import { decodePaymentRequiredHeader } from "@x402/core/http";
import Link from "next/link";
import {
  useEffect,
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
  readFusdBalanceAtomic,
  signBrowserX402Payment,
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

function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
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
  } | null>(null);
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

  useEffect(() => {
    const ethereum = getBrowserEthereumProvider();
    if (!ethereum?.on || !ethereum?.removeListener || !walletAddress) return;

    const handleAccountsChanged = (accounts: unknown) => {
      if (
        !Array.isArray(accounts) ||
        typeof accounts[0] !== "string" ||
        !isAddress(accounts[0])
      ) {
        setWalletAddress(null);
        setFusdBalanceAtomic(null);
        return;
      }
      const next = getAddress(accounts[0]);
      setWalletAddress(next);
      void readFusdBalanceAtomic(next)
        .then(setFusdBalanceAtomic)
        .catch(() => {});
    };

    const handleChainChanged = (rawChainId: unknown) => {
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
      const balance = await readFusdBalanceAtomic(address);
      setFusdBalanceAtomic(balance);
      setWalletError(null);
    } catch (cause) {
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "Unable to read fUSD balance on Avalanche.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleConnectWallet() {
    setWalletError(null);
    setError(null);
    setWalletBusy(true);
    try {
      const connected = await connectBrowserWallet();
      await ensureAvalancheChain();
      setWalletAddress(connected.address);
      setWalletChainId(AVALANCHE_CHAIN_ID);
      const balance = await readFusdBalanceAtomic(connected.address);
      setFusdBalanceAtomic(balance);
    } catch (cause) {
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "Wallet connection was canceled or unavailable.",
      );
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleSwitchAvalanche() {
    setWalletError(null);
    setWalletBusy(true);
    try {
      await ensureAvalancheChain();
      setWalletChainId(AVALANCHE_CHAIN_ID);
      if (walletAddress) {
        const balance = await readFusdBalanceAtomic(walletAddress);
        setFusdBalanceAtomic(balance);
      }
    } catch (cause) {
      setWalletError(
        cause instanceof Error
          ? cause.message
          : "Could not switch wallet network to Avalanche.",
      );
    } finally {
      setWalletBusy(false);
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

    setRunning(true);
    try {
      await ensureAvalancheChain();
      setWalletChainId(AVALANCHE_CHAIN_ID);

      const latestBalance = await readFusdBalanceAtomic(walletAddress);
      setFusdBalanceAtomic(latestBalance);
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
      });

      if (challengeResponse.status === 200) {
        const immediate =
          (await challengeResponse.json()) as InvokeSuccessPayload;
        setOutput(immediate);
        setViewTab("dataset");
        void readFusdBalanceAtomic(walletAddress)
          .then(setFusdBalanceAtomic)
          .catch(() => {});
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

      for (let attempt = 0; attempt < MAX_SETTLEMENT_POLLS; attempt += 1) {
        const paidResponse = await fetch("/api/facet/invoke", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
            "payment-signature": paymentSignature,
          },
          body: requestBody,
        });

        if (paidResponse.status === 202) {
          const pending = (await paidResponse
            .json()
            .catch(() => null)) as PendingPayload | null;
          setPendingState({
            ...(pending?.runId ? { runId: pending.runId } : {}),
            status: pending?.payment?.status ?? "settlement_pending",
            ...(pending?.payment?.transaction
              ? { transaction: pending.payment.transaction }
              : {}),
          });
          if (attempt + 1 >= MAX_SETTLEMENT_POLLS) {
            setError(
              `Settlement is still confirming on Avalanche${pending?.runId ? ` (runId: ${pending.runId})` : ""}. Wait a moment and retry.`,
            );
            return;
          }
          await waitMs(
            parseRetryAfterMs(paidResponse.headers.get("retry-after")),
          );
          continue;
        }

        if (paidResponse.status === 502) {
          const refunded = (await paidResponse
            .json()
            .catch(() => null)) as RefundedErrorPayload | null;
          setPendingState(null);
          if (refunded?.payment?.status === "refunded") {
            setRefundedError({
              code: refunded.error?.code ?? "EXECUTION_FAILED",
              ...(refunded.error?.message
                ? { message: refunded.error.message }
                : {}),
              ...(refunded.runId ? { runId: refunded.runId } : {}),
              ...(refunded.payment.transaction
                ? { transaction: refunded.payment.transaction }
                : {}),
              ...(refunded.payment.refundAmountAtomic
                ? { refundAmountAtomic: refunded.payment.refundAmountAtomic }
                : {}),
            });
            void readFusdBalanceAtomic(walletAddress)
              .then(setFusdBalanceAtomic)
              .catch(() => {});
            return;
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

        setPendingState(null);
        setOutput(body);
        setViewTab("dataset");
        void readFusdBalanceAtomic(walletAddress)
          .then(setFusdBalanceAtomic)
          .catch(() => {});
        return;
      }
    } catch (err) {
      setPendingState(null);
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setRunning(false);
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
    </section>
  );
}
