"use client";

import { useState } from "react";

interface CommerceStage {
  id: string;
  number: string;
  title: string;
  heading: string;
  summary: string;
  points: readonly string[];
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
      "Pinned JSON input and output contracts per published version",
      "Transparent per-run or per-result pricing quoted upfront",
      "Ranked by verified execution history and uptime",
    ],
  },
  {
    id: "authorize",
    number: "02",
    title: "Scoped Spending Grants",
    heading: "Bounded Autonomy With Zero Exposed Keys",
    summary:
      "Operators create isolated wallets governed by enforceable spending grants—setting per-call limits, rolling budgets, and instant revocation while keeping private keys strictly outside agent prompts.",
    points: [
      "Agents authenticate with scoped grant tokens, never raw wallet keys",
      "Enforce max spend per call, total budget limits, and allowed modalities",
      "Pause, rotate, or revoke any grant instantly across all active sessions",
    ],
  },
  {
    id: "execute",
    number: "03",
    title: "Zero-Trust Execution",
    heading: "Protected Secrets and Isolated Runtimes",
    summary:
      "Upstream API credentials are injected inside an encrypted gateway vault; Actor modules run in digest-verified sandboxes; duplicate retries are deduplicated automatically before execution.",
    points: [
      "Provider secrets stay encrypted and hidden from calling agents",
      "Immutable runtime digests verified before every Actor run",
      "Request fingerprinting prevents duplicate execution on retries",
    ],
  },
  {
    id: "settle",
    number: "04",
    title: "Atomic x402 Settlement",
    heading: "Pay Per Call With Automatic Escrow Protection",
    summary:
      "Stablecoin micropayments settle autonomously at sub-second finality over HTTP x402—eliminating monthly SaaS subscriptions while protecting pay-per-result buyers with automatic escrow refunds.",
    points: [
      "True sub-cent pay-per-use pricing with zero subscription lock-in",
      "Instant creator payout upon verified single-run completion",
      "Automatic buyer refund when escrowed item targets are not met",
    ],
  },
  {
    id: "verify",
    number: "05",
    title: "Cryptographic Receipts",
    heading: "Audit Every Output and Earned Trust Score",
    summary:
      "Every completed execution anchors cryptographic input hashes, output digests, item counts, and payment proofs on-chain—providing a verifiable audit trail and portable reputation.",
    points: [
      "Immutable receipt binding caller input hash to delivered dataset",
      "Signed runtime attestation proving which exact digest executed",
      "Portable on-chain trust score shared across providers and Agents",
    ],
  },
];

/**
 * Minimal single-menu interactive showcase of FACET's production architecture.
 */
export function CommerceEngineShowcase() {
  const [activeId, setActiveId] = useState<string>(COMMERCE_STAGES[0].id);
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
