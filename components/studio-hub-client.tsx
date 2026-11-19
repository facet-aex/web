import Link from "next/link";

import { FACET_TYPE_META } from "@/lib/facet-ui";

const WORKFLOW_CARDS = [
  {
    meta: FACET_TYPE_META.API,
    inspiration: "Gateway Proxy Console",
    steps: [
      "Define a GET endpoint or import an OpenAPI 3.0/3.1 spec",
      "Configure upstream URL, headers, and encrypted secret vault",
      "Validate contract warnings and publish as a Facet to Store",
    ],
    ctaLabel: "Open API Studio",
  },
  {
    meta: FACET_TYPE_META.ACTOR,
    inspiration: "Isolated Container Runner",
    steps: [
      "Load a starter template or write ESM main.mjs run(input)",
      "Design inputs visually with the JSON Schema Builder + Form Preview",
      "Choose PAY_PER_RUN or PAY_PER_RESULT and publish as a Facet",
    ],
    ctaLabel: "Open Actor Studio",
  },
  {
    meta: FACET_TYPE_META.AGENT,
    inspiration: "On-Chain Agent Card",
    steps: [
      "Bind an Avalanche Fuji Agent Identity Token ID (#1+)",
      "Preview the live On-Chain Agent Card, payout wallet & task schema",
      "Publish as a Facet and optionally verify your Registry tx",
    ],
    ctaLabel: "Open Agent Studio",
  },
];

export function StudioHubClient() {
  return (
    <div className="studio-hub">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Studio / Publish a Facet</p>
          <h1 className="page-title">Publish a Facet</h1>
        </div>
        <p>
          Every signed-in account publishes directly to Store. All three forms
          <strong> API</strong>, <strong>Actor</strong>, and{" "}
          <strong>Agent</strong> become a single standardized{" "}
          <strong>Facet</strong> with shared schemas, x402 pricing, and
          receipts.
        </p>
      </header>

      <div className="facet-taxonomy-shell">
        <div
          className="facet-taxonomy-bar"
          aria-label="Unified Facet output standard"
        >
          <div className="facet-taxonomy-core">
            <span className="facet-taxonomy-pill">FACET</span>
            <strong>Every Builder Outputs One Standardized Facet</strong>
          </div>
          <ul className="facet-taxonomy-traits">
            <li>JSON Input Schema</li>
            <li>x402 fUSD Billing</li>
            <li>On-Chain Receipt</li>
            <li>MCP Discovery</li>
          </ul>
        </div>

        <section
          className="studio-hub-grid"
          aria-label="Choose Facet creation workflow"
        >
          {WORKFLOW_CARDS.map(({ meta, inspiration, steps, ctaLabel }) => (
            <article
              key={meta.type}
              className={`studio-hub-card ${meta.accentClass}`}
            >
              <div className="modality-card-top">
                <span className={`badge-type badge-${meta.accentClass}`}>
                  {meta.glyph} {meta.facetTag}
                </span>
                <span className="hub-inspiration">{inspiration}</span>
              </div>
              <h2>{meta.shortLabel}</h2>
              <p className="modality-desc">{meta.description}</p>
              <ol className="hub-step-list">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="studio-hub-card-footer">
                <Link className="button button-primary" href={meta.studioHref}>
                  {ctaLabel} <span aria-hidden="true">↗</span>
                </Link>
                <Link className="back-link" href={meta.storeHref}>
                  View {meta.shortLabel} in Store →
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
