"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";

import {
  FUJI_CONTRACTS,
  formatAtomicFusd,
  isValidEvmAddress,
  snowtraceAddressUrl,
  truncateMiddle,
} from "@/lib/facet-ui";

export interface FaucetStatusData {
  enabled: boolean;
  dripAtomic: string;
  addressCooldownSec: number;
}

export interface FaucetClaimResult {
  address: string;
  amountAtomic: string;
  balanceAtomic: string;
  txHash: string;
  explorerUrl: string;
  nextClaimAt: string;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getEthereumProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as Window & { ethereum?: Eip1193Provider })
    .ethereum;
  return candidate && typeof candidate.request === "function"
    ? candidate
    : undefined;
}

function formatCooldownHours(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${seconds} seconds`;
}

function subscribeNoop(): () => void {
  return () => {};
}

export function FaucetForm({
  initialStatus,
}: {
  initialStatus: FaucetStatusData;
}) {
  const [address, setAddress] = useState("");
  const hasWallet = useSyncExternalStore(
    subscribeNoop,
    () => Boolean(getEthereumProvider()),
    () => false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextClaimHint, setNextClaimHint] = useState<string | null>(null);
  const [result, setResult] = useState<FaucetClaimResult | null>(null);

  async function handleConnectWallet() {
    const provider = getEthereumProvider();
    if (!provider) return;
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as unknown;
      if (
        Array.isArray(accounts) &&
        typeof accounts[0] === "string" &&
        isValidEvmAddress(accounts[0])
      ) {
        setAddress(accounts[0]);
      }
    } catch {
      setError("Wallet connection was canceled or unavailable.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!isValidEvmAddress(trimmed)) {
      setError("Paste a valid Avalanche 0x wallet address.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNextClaimHint(null);
    setResult(null);

    try {
      const response = await fetch("/api/facet/faucet/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      });
      const payload = (await response.json()) as
        | FaucetClaimResult
        | {
            error?: {
              code?: string;
              message?: string;
              details?: { nextClaimAt?: string };
            };
          };

      if (!response.ok || !("txHash" in payload)) {
        const apiError = "error" in payload ? payload.error : undefined;
        setError(
          apiError?.message ??
            "Unable to dispense test fUSD right now. Please try again.",
        );
        if (apiError?.details?.nextClaimAt) {
          setNextClaimHint(apiError.details.nextClaimAt);
        }
        return;
      }

      setResult(payload);
    } catch {
      setError("Network error contacting faucet service.");
    } finally {
      setSubmitting(false);
    }
  }

  const dripLabel = formatAtomicFusd(initialStatus.dripAtomic);
  const cooldownLabel = formatCooldownHours(initialStatus.addressCooldownSec);

  return (
    <section className="faucet-card" aria-label="Testnet fUSD Faucet">
      {!initialStatus.enabled ? (
        <div className="faucet-banner faucet-banner-warning" role="status">
          The testnet fUSD faucet is temporarily unavailable on this deployment.
        </div>
      ) : null}

      <form className="faucet-form" onSubmit={handleSubmit}>
        <div className="faucet-field-header">
          <label className="faucet-label" htmlFor="faucet-address-input">
            Avalanche Wallet Address
          </label>
          {hasWallet ? (
            <button
              type="button"
              className="faucet-connect-button"
              onClick={handleConnectWallet}
              disabled={connecting || submitting}
            >
              {connecting ? "Connecting..." : "Use Connected Wallet"}
            </button>
          ) : null}
        </div>

        <div className="faucet-input-row">
          <input
            id="faucet-address-input"
            name="address"
            type="text"
            className="faucet-input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
            disabled={submitting}
          />
          <button
            type="submit"
            className="button-primary faucet-submit-button"
            disabled={submitting || !initialStatus.enabled}
          >
            {submitting ? "Sending..." : "Faucet"}
          </button>
        </div>

        <p className="faucet-meta">
          Claim <strong>{dripLabel}</strong> per transfer on{" "}
          <strong>Avalanche</strong> (cooldown {cooldownLabel}). Token contract:{" "}
          <a
            href={snowtraceAddressUrl(FUJI_CONTRACTS.fusd)}
            target="_blank"
            rel="noreferrer"
          >
            {truncateMiddle(FUJI_CONTRACTS.fusd)}
          </a>
        </p>
      </form>

      {error ? (
        <div className="faucet-banner faucet-banner-error" role="alert">
          <p>{error}</p>
          {nextClaimHint ? (
            <p className="faucet-next-claim">
              Next eligible claim: {nextClaimHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="faucet-result" role="status">
          <div className="faucet-result-header">
            <span className="eyebrow">Sent On-Chain ✓</span>
            <span className="faucet-amount">
              +{formatAtomicFusd(result.amountAtomic)}
            </span>
          </div>
          <dl className="inspector-specs">
            <div>
              <dt>Recipient</dt>
              <dd>{truncateMiddle(result.address)}</dd>
            </div>
            <div>
              <dt>Updated fUSD Balance</dt>
              <dd>{formatAtomicFusd(result.balanceAtomic)}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd>
                <a href={result.explorerUrl} target="_blank" rel="noreferrer">
                  {truncateMiddle(result.txHash, 12, 8)} ↗
                </a>
              </dd>
            </div>
            <div>
              <dt>Next Eligible Claim</dt>
              <dd>{result.nextClaimAt}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
