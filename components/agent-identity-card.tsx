"use client";

import { useState } from "react";

import {
  ERC8004_IDENTITY_REGISTRY,
  FUJI_CHAIN_ID,
  formatAtomicFusd,
  isValidEvmAddress,
  isValidTxHash,
  snowtraceAddressUrl,
  snowtraceTxUrl,
  truncateMiddle,
} from "@/lib/facet-ui";
import type { FacetPricingOption, PricingModel } from "@/lib/public-catalog";

export interface AgentIdentityCardProps {
  facetDisplayName: string;
  facetName: string;
  provider?: string;
  version?: string;
  summary: string;
  erc8004Registry?: string;
  erc8004TokenId: string;
  taskKind: string;
  pricingModel: PricingModel;
  priceAtomic: string;
  pricingOptions?: FacetPricingOption[];
  payTo?: string;
  registryVerified?: boolean;
  registryTxHash?: string;
  inputFields?: string[];
}

export function AgentIdentityCard({
  facetDisplayName,
  facetName,
  provider,
  version,
  summary,
  erc8004Registry = ERC8004_IDENTITY_REGISTRY,
  erc8004TokenId,
  taskKind,
  pricingModel,
  priceAtomic,
  pricingOptions,
  payTo,
  registryVerified,
  registryTxHash,
  inputFields = [],
}: AgentIdentityCardProps) {
  const [showJson, setShowJson] = useState(false);

  const normalizedRegistry =
    erc8004Registry.trim() || ERC8004_IDENTITY_REGISTRY;
  const unit = pricingModel === "PAY_PER_RESULT" ? "item" : "run";
  const isExecutableTaskKind = taskKind.trim() === "vn-market-analysis";
  const hasValidToken = /^[1-9][0-9]*$/u.test(erc8004TokenId.trim());
  const hasValidPayTo = Boolean(payTo && isValidEvmAddress(payTo));
  const hasValidTx = Boolean(registryTxHash && isValidTxHash(registryTxHash));

  const verificationLabel = registryVerified
    ? "Verified on Avalanche ✓"
    : hasValidTx
      ? "Registry Tx Supplied"
      : "Draft Preview";

  const verificationClass = registryVerified
    ? "agent-verify-ok"
    : hasValidTx
      ? "agent-verify-pending"
      : "agent-verify-draft";

  const agentCardPayload = {
    schemaVersion: "facet.a2a-card/v1",
    ...(provider ? { provider } : {}),
    facetName: facetName.trim() || "autonomous-agent",
    facetDisplayName: facetDisplayName.trim() || "Untitled Agent",
    ...(version ? { version } : {}),
    summary: summary.trim(),
    onChainIdentity: {
      chainId: FUJI_CHAIN_ID,
      registry: normalizedRegistry,
      tokenId: erc8004TokenId.trim() || null,
      verifiedOnRegistry: Boolean(registryVerified),
      ...(hasValidTx ? { registryTxHash: registryTxHash!.trim() } : {}),
    },
    a2a: {
      protocolVersion: "1.0",
      taskKind: taskKind.trim() || "vn-market-analysis",
      mcpCompatible: true,
      inputProperties: inputFields,
    },
    settlement: {
      protocol: "x402",
      network: "eip155:43113",
      asset: "fUSD",
      pricingModel,
      priceAtomic: priceAtomic.trim() || "1000",
      ...(pricingOptions && pricingOptions.length > 0
        ? { pricingOptions }
        : {}),
      payTo: hasValidPayTo ? payTo!.trim() : "provider-default",
    },
  };

  return (
    <section className="agent-card" aria-label="On-Chain Agent Card">
      <div className="agent-card-top">
        <div className="agent-card-badges">
          <span className="badge-type badge-agent">
            ON-CHAIN AGENT IDENTITY
          </span>
          <span className="agent-chain-pill">AVALANCHE ({FUJI_CHAIN_ID})</span>
        </div>
        <span className={`agent-verify-pill ${verificationClass}`}>
          {verificationLabel}
        </span>
      </div>

      <div className="agent-card-identity">
        <div className="agent-monogram" aria-hidden="true">
          {(facetDisplayName.trim()[0] ?? "A").toUpperCase()}
          {(facetName.trim()[1] ?? "2").toUpperCase()}
        </div>
        <div className="agent-card-title-block">
          <h3>{facetDisplayName.trim() || "Untitled Agent"}</h3>
          <p className="agent-card-handle">
            {provider ? `${provider}/` : "@"}
            {facetName.trim() || "agent-name"}
            {version ? `@${version}` : ""} ·{" "}
            <span>{taskKind.trim() || "vn-market-analysis"}</span>
          </p>
        </div>
      </div>

      <p className="agent-card-summary">
        {summary.trim() ||
          "Describe what tasks callers or client agents can delegate to this Agent."}
      </p>

      <div className="agent-card-compat">
        <span
          className={
            isExecutableTaskKind ? "compat-pill compat-ready" : "compat-pill"
          }
        >
          {isExecutableTaskKind
            ? "Avalanche Runner Compatible ✓"
            : "Registry Metadata Only (custom taskKind)"}
        </span>
        <button
          type="button"
          className="preset-chip"
          onClick={() => setShowJson((prev) => !prev)}
        >
          {showJson ? "View Card UI" : "Agent Card JSON"}
        </button>
      </div>

      {showJson ? (
        <pre className="json-pre agent-card-json">
          {JSON.stringify(agentCardPayload, null, 2)}
        </pre>
      ) : (
        <dl className="agent-card-grid">
          <div>
            <dt>Identity Token ID</dt>
            <dd className={hasValidToken ? "mono-accent" : "mono-warn"}>
              {hasValidToken
                ? `#${erc8004TokenId.trim()}`
                : "Token ID >= 1 required"}
            </dd>
          </div>
          <div>
            <dt>x402 Fee / Settlement</dt>
            <dd>
              {pricingOptions && pricingOptions.length > 0 ? (
                <div className="detail-pricing-list">
                  {pricingOptions.map((option) => (
                    <span key={option.model}>
                      {option.model}: {formatAtomicFusd(option.priceAtomic)} /{" "}
                      {option.model === "PAY_PER_RESULT" ? "item" : "run"}
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  {formatAtomicFusd(priceAtomic)} / {unit}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Identity Registry</dt>
            <dd>
              {isValidEvmAddress(normalizedRegistry) ? (
                <a
                  className="explorer-link"
                  href={snowtraceAddressUrl(normalizedRegistry)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {normalizedRegistry} ↗
                </a>
              ) : (
                normalizedRegistry
              )}
            </dd>
          </div>
          <div>
            <dt>Agent Wallet (payTo)</dt>
            <dd>
              {hasValidPayTo ? (
                <a
                  className="explorer-link"
                  href={snowtraceAddressUrl(payTo!.trim())}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncateMiddle(payTo!.trim(), 10, 8)} ↗
                </a>
              ) : (
                "Provider default wallet"
              )}
            </dd>
          </div>
          <div>
            <dt>Protocol &amp; Discovery</dt>
            <dd>A2A v1.0 · MCP (search_facets / get_facet / invoke_facet)</dd>
          </div>
          {hasValidTx ? (
            <div>
              <dt>FacetActorRegistry Tx</dt>
              <dd>
                <a
                  className="explorer-link"
                  href={snowtraceTxUrl(registryTxHash!.trim())}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncateMiddle(registryTxHash!.trim(), 10, 8)} ↗
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      {inputFields.length > 0 ? (
        <div className="agent-card-inputs">
          <span>Task Input Fields</span>
          <div className="agent-input-chips">
            {inputFields.map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
