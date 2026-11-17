import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FACET_TYPE_META } from "@/lib/facet-ui";

const MODALITIES = [
  {
    index: "01",
    meta: FACET_TYPE_META.EXTERNAL_HTTP_API,
    runtimeSubtitle: "Gateway Proxy · REST & OpenAPI",
    highlights: [
      "Quick GET endpoint builder or OpenAPI 3.0/3.1 spec import",
      "Encrypted secret vault with SSRF DNS/IP pinning",
      "Gateway metering + x402 settlement in fUSD",
    ],
  },
  {
    index: "02",
    meta: FACET_TYPE_META.HOSTED_ACTOR,
    runtimeSubtitle: "Container Runner · Node.js 22 ESM",
    highlights: [
      "Single ESM main.mjs file + visual Input Schema Builder",
      "Capped Docker sandbox (0.5 vCPU, 128 MB, --network=none)",
      "Structured Dataset output + on-chain imageDigest anchor",
    ],
  },
  {
    index: "03",
    meta: FACET_TYPE_META.AUTONOMOUS_AGENT,
    runtimeSubtitle: "ERC-8004 Identity · Task Delegation",
    highlights: [
      "Bound to canonical Avalanche Fuji ERC-8004 Identity",
      "Live verifiable On-Chain Agent Card & task contract",
      "Instant FeeSplit payout or TaskEscrow per-item settlement",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="page-shell">
      <SiteHeader activeSection="home" />
      <main>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="constellation" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow">
              Federated Agent Capability Exchange &amp; Trust
            </p>
            <h1 id="hero-title">
              Find the missing
              <span>capability.</span>
            </h1>
            <p className="hero-intro">
              Every capability on this marketplace is a verifiable{" "}
              <strong>Facet</strong>—packaged as an <strong>API</strong>, an{" "}
              <strong>Actor</strong>, or an <strong>Agent</strong> under one
              unified x402 payment, JSON Schema, and MCP interface on Avalanche
              Fuji.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button button-primary" href="/store">
              Explore Facet Store <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" href="/studio">
              Open Studio <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-ghost" href="/docs">
              Read Docs <span aria-hidden="true">→</span>
            </Link>
          </div>
          <dl className="hero-sequence" aria-label="FACET execution lifecycle">
            {[
              ["01", "Discover Facets via Store or MCP"],
              ["02", "Verify Digest & ERC-8004"],
              ["03", "Pay fUSD over x402"],
              ["04", "Receive Dataset & Receipt"],
            ].map(([number, label]) => (
              <div key={number}>
                <dt>{number}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="landing-modalities"
          aria-labelledby="modalities-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Unified Model / What is a Facet?</p>
              <h2 id="modalities-title">
                API, Actor &amp; Agent — All Are Facets.
              </h2>
            </div>
            <p>
              Whether you wrap an upstream endpoint, run container code, or bind
              an on-chain identity, every published entry becomes a{" "}
              <strong>Facet</strong> sharing the same schema contract, fUSD
              pricing, and execution receipt.
            </p>
          </div>

          <div
            className="facet-taxonomy-bar"
            aria-label="Unified Facet standard"
          >
            <div className="facet-taxonomy-core">
              <span className="facet-taxonomy-pill">FACET</span>
              <strong>Shared Standard Across All Three Types</strong>
            </div>
            <ul className="facet-taxonomy-traits">
              <li>JSON Schema Contract</li>
              <li>x402 fUSD Billing</li>
              <li>On-Chain Receipt</li>
              <li>MCP Tool Discovery</li>
            </ul>
          </div>

          <div className="modality-grid">
            {MODALITIES.map(({ index, meta, runtimeSubtitle, highlights }) => (
              <article
                key={meta.type}
                className={`modality-card ${meta.accentClass}`}
              >
                <div className="modality-card-top">
                  <span className="modality-index">{index}</span>
                  <span className={`badge-type badge-${meta.accentClass}`}>
                    {meta.glyph} {meta.facetTag}
                  </span>
                </div>
                <h3>{meta.shortLabel}</h3>
                <p className="modality-subtitle">{runtimeSubtitle}</p>
                <p className="modality-desc">{meta.description}</p>
                <ul className="modality-bullets">
                  {highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="modality-card-actions">
                  <Link
                    className="button button-primary"
                    href={meta.studioHref}
                  >
                    Create {meta.shortLabel} <span aria-hidden="true">↗</span>
                  </Link>
                  <Link className="button button-ghost" href={meta.storeHref}>
                    Browse {meta.shortLabel} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-agent-cta"
          aria-labelledby="agent-cta-title"
        >
          <div className="landing-cta-copy">
            <p className="eyebrow">Built for Agents &amp; Humans</p>
            <h2 id="agent-cta-title">
              Connect Claude, Cursor, or TypeScript agents in minutes.
            </h2>
            <p>
              Use the FACET MCP Server (<code>search_facets</code>,{" "}
              <code>get_facet</code>, <code>invoke_facet</code>) or{" "}
              <code>@facet/agent-sdk</code> with capped Fuji testnet wallets so
              clients discover Facet schemas, sign x402 quotes, and verify
              receipts automatically.
            </p>
          </div>
          <div className="landing-cta-buttons">
            <Link className="button button-primary" href="/docs#agent-guide">
              Integration Guide <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-ghost" href="/store">
              Browse Facet Store <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
