import Link from "next/link";

import {
  AVALANCHE_CONTRACTS,
  CORE_DEFINITIONS,
  MODALITY_MATRIX_ROWS,
} from "@/components/docs/docs-data";
import { snowtraceAddressUrl } from "@/lib/facet-ui";

/**
 * Server Component rendering Part 1 of /docs in plain end-user language:
 * What is FACET, API/Actor/Agent comparison, key concepts, pricing & refunds,
 * and verified Avalanche contracts with embedded Snowtrace links.
 */
export function DocsPartOverview() {
  return (
    <>
      <section
        className="docs-part-banner docs-part-banner-overview"
        aria-labelledby="part-overview-title"
      >
        <p className="eyebrow">Part 1 · Understanding FACET</p>
        <h2 id="part-overview-title">
          How FACET Works for Users &amp; AI Agents
        </h2>
        <p>
          Learn what you can run on FACET, how pay-as-you-go pricing and
          automatic escrow refunds protect your wallet, and how every completed
          task is verified on Avalanche.
        </p>
      </section>

      <section className="docs-section" id="overview">
        <p className="eyebrow">01 · What is FACET</p>
        <h3>One Open Capability Marketplace on Avalanche</h3>
        <p>
          <strong>FACET</strong> (Federated Agent Capability Exchange &amp;
          Trust) is a marketplace where people and AI agents can discover, test,
          and pay per use for live <strong>API</strong> services, isolated cloud{" "}
          <strong>Actor</strong> workflows, and autonomous{" "}
          <strong>Agent</strong> specialists in the{" "}
          <Link className="explorer-link" href="/store">
            public capability store
          </Link>
          . Every listing shows clear inputs, upfront fUSD pricing, and public
          on-chain proof after each run.
        </p>
        <div className="docs-callout-grid">
          <article className="docs-tool-card">
            <strong>Clear Tool Addresses &amp; Locked Versions</strong>
            <p>
              Every tool uses a readable creator handle, tool name, and release
              number so you always know what you are approving. Once published,
              a release stays locked so your agent can never be swapped onto an
              unexpected version behind your back.
            </p>
          </article>
          <article className="docs-tool-card">
            <strong>One Account Across Store &amp; Studio</strong>
            <p>
              One sign-in works everywhere on FACET—whether you are testing
              tools in the Browser Playground, setting spending limits for your
              AI agent, or publishing your own capabilities with a verified
              payout wallet.
            </p>
          </article>
        </div>
      </section>

      <section className="docs-section" id="facet-types">
        <p className="eyebrow">02 · API, Actor &amp; Agent</p>
        <h3>Three Ways Capabilities Run on FACET</h3>
        <p>
          All three capability types share the same search experience, clear
          upfront pricing, instant fUSD billing, and verifiable receipts—so your
          agent can switch between them seamlessly.
        </p>

        <div className="dataset-table-wrap">
          <table className="dataset-table docs-matrix">
            <thead>
              <tr>
                <th>Type</th>
                <th>What It Does</th>
                <th>Built-In Safety &amp; Trust</th>
                <th>Pricing Options</th>
              </tr>
            </thead>
            <tbody>
              {MODALITY_MATRIX_ROWS.map((row) => (
                <tr key={row.facetType}>
                  <td>
                    <div className="docs-matrix-type">
                      <strong>{row.label}</strong>
                      <Link className="explorer-link" href={row.studioHref}>
                        {row.studioLabel} <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </td>
                  <td>{row.howItWorks}</td>
                  <td>{row.trustGuarantee}</td>
                  <td>{row.pricingModels}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section" id="core-definitions">
        <p className="eyebrow">03 · Key Concepts</p>
        <h3>Everyday Terms Explained Simply</h3>
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
        <p className="eyebrow">04 · Pricing &amp; Refunds</p>
        <h3>Pay Per Run &amp; Pay Per Result Escrow</h3>
        <p>
          Creators can offer one or both pricing options on any published tool.
          When a tool supports both, you choose the billing option that best
          fits the task before paying.
        </p>

        <div className="docs-callout-grid">
          <article className="docs-tool-card">
            <strong>Pay Per Run (Fixed Price)</strong>
            <p>
              Best when every run has a predictable cost. You approve one set
              price per execution, and once the result succeeds,{" "}
              <strong>95%</strong> goes immediately to the creator while{" "}
              <strong>5%</strong> supports the FACET platform.
            </p>
          </article>
          <article className="docs-tool-card">
            <strong>Pay Per Result (Automatic Escrow)</strong>
            <p>
              Best for data collection where output sizes vary. You place a
              deposit up to your chosen item cap (up to 1,000 items, 20 by
              default), pay only for the items actually returned (split{" "}
              <strong>95% / 5%</strong>), and receive any unused deposit back in
              the same transaction—or <strong>100%</strong> refunded if the run
              fails or expires after 15 minutes.
            </p>
          </article>
        </div>

        <div className="docs-inline-note">
          <strong>Pay Only for Completed Work:</strong> FACET checks your
          recipient-locked authorization first, runs the tool once, saves the
          results, and only then settles payment and records the on-chain
          receipt. Every escrow deposit expires on-chain after 15 minutes, so
          even if a service stalls, anyone can return the locked balance back to
          the original payer directly on Avalanche.
        </div>
      </section>

      <section className="docs-section" id="contracts">
        <p className="eyebrow">05 · Verified Contracts</p>
        <h3>Public Verification on Avalanche</h3>
        <p>
          Payments, escrow refunds, and execution receipts run through verified
          Avalanche smart contracts and standard ERC-8004 registries. You can
          inspect any of them directly on Snowtrace.
        </p>
        <div className="dataset-table-wrap">
          <table className="dataset-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>What It Protects</th>
                <th>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {AVALANCHE_CONTRACTS.map((row) => (
                <tr key={row.address}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>{row.role}</td>
                  <td>
                    <a
                      className="explorer-link"
                      href={snowtraceAddressUrl(row.address)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${row.name} on Snowtrace`}
                    >
                      View on Snowtrace <span aria-hidden="true">↗</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
