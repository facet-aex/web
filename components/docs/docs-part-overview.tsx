import Link from "next/link";

import { CopyCodeBlock } from "@/components/copy-code-block";
import {
  ACTOR_ESM_SNIPPET,
  AVALANCHE_CONTRACTS,
  CORE_DEFINITIONS,
  MODALITY_MATRIX_ROWS,
} from "@/components/docs/docs-data";
import { snowtraceAddressUrl } from "@/lib/facet-ui";

/**
 * Server Component rendering Part 1 of /docs: Project Overview, 3-Modality Matrix,
 * Core Definitions, Multi-Pricing & TaskEscrow, and Verified Avalanche Contracts.
 */
export function DocsPartOverview() {
  return (
    <>
      <section
        className="docs-part-banner docs-part-banner-overview"
        aria-labelledby="part-overview-title"
      >
        <p className="eyebrow">Part 1 · Project Overview &amp; Core Concepts</p>
        <h2 id="part-overview-title">
          How FACET Standardizes APIs, Actors &amp; Agents
        </h2>
        <p>
          Understand <code>FacetManifest v1</code>, natural-key addressing,
          modality execution guarantees, multi-method <code>fUSD</code>{" "}
          settlement with <code>TaskEscrow</code>, and the verified smart
          contracts on Avalanche.
        </p>
      </section>

      <section className="docs-section" id="overview">
        <p className="eyebrow">01 · What is FACET</p>
        <h3>One Unified Capability Standard on Avalanche</h3>
        <p>
          <strong>FACET</strong> (Federated Agent Capability Exchange &amp;
          Trust) is a multi-modal capability marketplace hosted at{" "}
          <code>https://facet.briandev.space</code>. Every published capability
          implements <code>FacetManifest v1</code>—unifying JSON Schema 2020-12
          input/output contracts, HTTP x402 v2 billing in 6-decimal{" "}
          <code>fUSD</code>, Model Context Protocol (MCP) discovery, and
          on-chain execution receipts across <strong>API</strong>,{" "}
          <strong>Actor</strong>, and <strong>Agent</strong> modalities.
        </p>
        <div className="docs-callout-grid">
          <article className="docs-tool-card">
            <strong>Natural-Key Addressing</strong>
            <p>
              Capabilities are addressed externally by{" "}
              <code>provider/facetName@version</code>—using 8–16 char kebab-case{" "}
              <code>provider</code>, 4–32 char kebab-case <code>facetName</code>
              , human-friendly <code>facetDisplayName</code>, and strict SemVer{" "}
              <code>version</code> (<code>MAJOR.MINOR.PATCH</code>). Internal
              database UUIDs are never exposed on public APIs, Store URLs, CLI,
              or MCP, and every published <code>FacetVersion</code> is
              immutable.
            </p>
          </article>
          <article className="docs-tool-card">
            <strong>Single-Account User-as-Provider</strong>
            <p>
              Humans sign in with Clerk into one unified account identified by
              their kebab-case provider handle. Publishing a Facet simply
              activates the Provider role on that same account, linked to a
              verified EOA payout address (<code>providerPayTo</code>) without
              separate organization accounts.
            </p>
          </article>
        </div>
      </section>

      <section className="docs-section" id="facet-types">
        <p className="eyebrow">02 · Modality Matrix</p>
        <h3>API, Actor &amp; Agent Execution Models</h3>
        <p>
          Every modality uses uppercase enums (<code>API</code>,{" "}
          <code>ACTOR</code>, <code>AGENT</code>) end to end and shares the same
          catalog search, schema checks, x402 billing, and on-chain receipt
          pipeline.
        </p>

        <div className="dataset-table-wrap">
          <table className="dataset-table docs-matrix">
            <thead>
              <tr>
                <th>Facet Type</th>
                <th>Execution Path &amp; Hardening</th>
                <th>Authoring &amp; On-Chain Registry</th>
                <th>Pricing Models</th>
              </tr>
            </thead>
            <tbody>
              {MODALITY_MATRIX_ROWS.map((row) => (
                <tr key={row.facetType}>
                  <td>
                    <div className="docs-matrix-type">
                      <strong>{row.label}</strong> (<code>{row.facetType}</code>
                      )
                      <Link className="explorer-link" href={row.studioHref}>
                        {row.studioHref} ({row.studioStatus})
                      </Link>
                    </div>
                  </td>
                  <td>{row.executionPath}</td>
                  <td>{row.trustAndAuthoring}</td>
                  <td>{row.pricingModels}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CopyCodeBlock
          title="Actor Single-File ESM Contract (main.mjs)"
          code={ACTOR_ESM_SNIPPET}
        />
      </section>

      <section className="docs-section" id="core-definitions">
        <p className="eyebrow">03 · Core Definitions</p>
        <h3>Platform &amp; Protocol Terminology</h3>
        <div className="docs-glossary-grid">
          {CORE_DEFINITIONS.map((item) => (
            <article className="docs-glossary-card" key={item.term}>
              <div className="docs-glossary-head">
                <strong>{item.term}</strong>
                <span className="docs-step-badge">{item.badge}</span>
              </div>
              <p>{item.summary}</p>
              {item.href && item.linkLabel ? (
                <Link className="explorer-link" href={item.href}>
                  {item.linkLabel} <span aria-hidden="true">↗</span>
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="docs-section" id="pricing-escrow">
        <p className="eyebrow">04 · Multi-Pricing &amp; Settlement</p>
        <h3>PAY_PER_RUN FeeSplit &amp; PAY_PER_RESULT TaskEscrow</h3>
        <p>
          Providers can attach <code>1</code> or <code>2</code>{" "}
          <code>pricingOptions[]</code> per published <code>FacetVersion</code>{" "}
          (one marked <code>isPrimary</code> and anchored on{" "}
          <code>FacetActorRegistry</code>). When a Facet offers both, callers
          choose <code>pricingModel</code> via x402 <code>accepts[]</code> at
          invocation time.
        </p>

        <div className="docs-callout-grid">
          <article className="docs-tool-card">
            <strong>PAY_PER_RUN (Instant FeeSplit)</strong>
            <p>
              Charges one fixed <code>priceAtomic</code> per execution. After
              verifying payment and running once,{" "}
              <code>FacetFeeSplitAndEscrow</code> distributes{" "}
              <strong>95%</strong> immediately to <code>providerPayTo</code> and{" "}
              <strong>5%</strong> to the protocol treasury.
            </p>
          </article>
          <article className="docs-tool-card">
            <strong>PAY_PER_RESULT (TaskEscrow)</strong>
            <p>
              Providers configure per-item <code>priceAtomic</code> and{" "}
              <code>maxItemsCap</code> (<code>1..1000</code>, default{" "}
              <code>20</code>). Buyers deposit{" "}
              <code>unitPrice × maxItemsCap</code> (<code>maxAmountAtomic</code>
              ) upfront; the runner signs{" "}
              <code>(runId, facetId, inputHash, outputHash, itemCount)</code>,
              settles <code>min(itemCount × unitPrice, maxAmount)</code> (95%/5%
              split), and refunds <code>maxAmount - actualAmount</code> in the
              same transaction—or <strong>100%</strong> on <code>502</code>{" "}
              failure.
            </p>
          </article>
        </div>

        <div className="docs-inline-note">
          <strong>Strict Paid Execution Ordering:</strong> verify x402
          authorization → execute workload once (API, Docker Actor, or Agent) →
          persist dataset &amp; output → settle FeeSplit / TaskEscrow and write{" "}
          <code>FacetReceiptLog</code> → return response.
        </div>
      </section>

      <section className="docs-section" id="contracts">
        <p className="eyebrow">
          05 · Avalanche (Chain ID 43113 · eip155:43113)
        </p>
        <h3>Verified Avalanche Smart Contracts</h3>
        <p>
          All six verified protocol and canonical <code>ERC-8004</code> contract
          deployments on Avalanche (<code>eip155:43113</code>) are listed below
          with live Snowtrace links.
        </p>
        <div className="dataset-table-wrap">
          <table className="dataset-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Avalanche Address</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {AVALANCHE_CONTRACTS.map((row) => (
                <tr key={row.address}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    <a
                      className="explorer-link docs-contract-address"
                      href={snowtraceAddressUrl(row.address)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.address} <span aria-hidden="true">↗</span>
                    </a>
                  </td>
                  <td>{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
