"use client";

import { useState, type JSX } from "react";

interface CommerceStage {
  id: string;
  number: string;
  title: string;
  heading: string;
  summary: string;
  points: readonly string[];
}

export interface CommerceEngineShowcaseProps {
  initialStageId?: string;
}

const COMMERCE_STAGES: readonly CommerceStage[] = [
  {
    id: "discover",
    number: "01",
    title: "Unified Discovery",
    heading: "One Catalog Across Every Tool Modality",
    summary:
      "Agents search a single schema-indexed marketplace across APIs, Actors, and peer Agents—checking live pricing, input contracts, and provider track record before calling anything.",
    points: [
      "Pinned JSON input and output contracts per published SemVer release",
      "Transparent PAY_PER_RUN or PAY_PER_RESULT pricing quoted upfront",
      "Ranked by verified execution history and on-chain registration",
    ],
  },
  {
    id: "authorize",
    number: "02",
    title: "Default-Deny Spend Policy",
    heading: "Bounded Autonomy With Local OS Keychain Wallets",
    summary:
      "Operators create a local Avalanche wallet inside protected OS Keychain storage and enforce a default-deny spend policy—setting per-run caps, UTC daily limits, and instant revocation while keeping private keys strictly outside agent prompts.",
    points: [
      "Private keys remain in local OS Keychain storage, never in MCP configs or prompts",
      "Policies pin exact provider, Facet, SemVer, providerPayTo, per-run max, and UTC daily cap",
      "Inspect spend history, pause, or revoke policies instantly across sessions",
    ],
  },
  {
    id: "execute",
    number: "03",
    title: "Zero-Trust Execution",
    heading: "Full-HTTP Gateway and Isolated Actor Runtimes",
    summary:
      "Full HTTP APIs (GET, POST, PUT, PATCH, DELETE) inject write-only encrypted vault secrets through SSRF-pinned proxies; Actor modules run in digest-verified sandboxes; duplicate retries are deduplicated automatically before execution.",
    points: [
      "Provider credentials stay encrypted in vault headers, query params, Bearer, or Basic auth",
      "Immutable Actor runtime digests verified on-chain before execution",
      "Idempotency-Key fingerprinting prevents duplicate charges on retries",
    ],
  },
  {
    id: "settle",
    number: "04",
    title: "Atomic x402 Settlement",
    heading: "Instant FeeSplit and TaskEscrow Refunds on Avalanche",
    summary:
      "Stablecoin fUSD micropayments settle autonomously over HTTP x402 on Avalanche—supporting instant 95%/5% FeeSplit on PAY_PER_RUN and TaskEscrow settlement with automatic buyer refunds on PAY_PER_RESULT.",
    points: [
      "PAY_PER_RUN settles 95% directly to providerPayTo and 5% to protocol treasury",
      "PAY_PER_RESULT uses TaskEscrow upfront and refunds unused or failed runs automatically",
      "True sub-cent pay-per-use pricing with zero monthly subscription lock-in",
    ],
  },
  {
    id: "verify",
    number: "05",
    title: "Cryptographic Receipts",
    heading: "FacetReceiptLog Audits and ERC-8004 Reputation",
    summary:
      "Every completed execution anchors cryptographic input hashes, output digests, item counts, and payment proofs via FacetReceiptLog on Avalanche—providing a verifiable audit trail and portable ERC-8004 reputation.",
    points: [
      "FacetReceiptLog binds caller inputHash to outputHash, itemCount, and payment tx",
      "Signed runner attestation proves which verified digest executed",
      "ERC-8004 identity and reputation registries anchor portable Agent trust on Avalanche",
    ],
  },
];

/**
 * Minimal single-menu interactive showcase of FACET's production architecture.
 */
export function CommerceEngineShowcase({
  initialStageId = COMMERCE_STAGES[0].id,
}: CommerceEngineShowcaseProps = {}): JSX.Element {
  const [activeId, setActiveId] = useState<string>(initialStageId);
  const activeIndex = Math.max(
    0,
    COMMERCE_STAGES.findIndex((stage) => stage.id === activeId),
  );
  const active = COMMERCE_STAGES[activeIndex];

  return (
    <div className="commerce-engine">
      <div
        className="commerce-rail"
        role="tablist"
        aria-label="FACET production capabilities"
      >
        {COMMERCE_STAGES.map((stage) => {
          const selected = stage.id === active.id;
          return (
            <button
              key={stage.id}
              type="button"
              role="tab"
              id={`tab-${stage.id}`}
              aria-selected={selected}
              aria-controls={`panel-${stage.id}`}
              className={
                selected ? "commerce-rail-btn is-active" : "commerce-rail-btn"
              }
              onClick={() => setActiveId(stage.id)}
            >
              <span className="commerce-rail-num">{stage.number}</span>
              <span className="commerce-rail-title">{stage.title}</span>
            </button>
          );
        })}
      </div>

      <article
        className="commerce-inspector"
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        <div className="commerce-counter">
          {active.number} / 0{COMMERCE_STAGES.length}
        </div>

        <h3>{active.heading}</h3>
        <p className="commerce-summary">{active.summary}</p>

        <ol className="commerce-point-list">
          {active.points.map((point, index) => (
            <li key={point}>
              <span>0{index + 1}</span>
              <p>{point}</p>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
