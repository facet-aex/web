import Link from "next/link";
import type { CSSProperties } from "react";

import { CommerceEngineShowcase } from "@/components/commerce-engine-showcase";
import { HeroParticleCanvas } from "@/components/hero-particle-canvas";
import { HomeScrollProgress, ScrollReveal } from "@/components/home-motion";
import { LandingQuickstart } from "@/components/landing-quickstart";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FACET_TYPE_META } from "@/lib/facet-ui";

const MODALITIES = [
  {
    index: "01",
    meta: FACET_TYPE_META.API,
    runtimeSubtitle: "Managed Gateway · Instant Monetization",
    description:
      "Turn any REST endpoint or OpenAPI spec into a pay-per-call Facet with encrypted secret injection, rate-limit controls, and automatic stablecoin billing.",
    highlights: [
      "Zero-code OpenAPI import or single endpoint setup",
      "Encrypted credential vault hides upstream keys from agents",
      "Per-call metering and instant x402 payout without API key sprawl",
    ],
  },
  {
    index: "02",
    meta: FACET_TYPE_META.ACTOR,
    runtimeSubtitle: "Serverless Containers · Structured Datasets",
    description:
      "Deploy web scrapers, data pipelines, and compute modules as isolated Actors returning verified structured datasets with immutable runtime digests.",
    highlights: [
      "Single-file code publish with visual input schema authoring",
      "Hash-pinned micro-containers audited against on-chain registry",
      "Pay-per-run or outcome-verified escrow with automatic refunds",
    ],
  },
  {
    index: "03",
    meta: FACET_TYPE_META.AGENT,
    runtimeSubtitle: "On-Chain Identity · Peer Delegation",
    description:
      "Expose specialized AI Agents with portable on-chain identity, bounded task contracts, and verified execution reputation across every client.",
    highlights: [
      "Portable on-chain Agent identity and verifiable capability card",
      "Delegate multi-step research and workflows with cited dataset proof",
      "Escrow-backed SLA settlement and cumulative live trust score",
    ],
  },
];

function enterDelay(ms: number): CSSProperties {
  return { "--enter-delay": `${ms}ms` } as CSSProperties;
}

export default function HomePage() {
  return (
    <div className="page-shell">
      <SiteHeader activeSection="home" />
      <HomeScrollProgress />
      <main>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <HeroParticleCanvas />
          <div className="hero-copy">
            <p
              className="eyebrow hero-eyebrow hero-enter"
              style={enterDelay(40)}
            >
              Federated Agent Capability Exchange &amp; Trust
            </p>
            <h1 id="hero-title">
              <span
                className="hero-title-line hero-enter"
                style={enterDelay(130)}
              >
                Give agents
              </span>
              <span
                className="hero-title-accent hero-enter"
                style={enterDelay(240)}
              >
                the tools to act
              </span>
            </h1>
            <div className="hero-cta-row hero-enter" style={enterDelay(340)}>
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
          </div>

          <dl
            className="hero-sequence"
            aria-label="What agents unlock on FACET"
          >
            {[
              [
                "01",
                "Call Private APIs",
                "Authenticated external endpoints without manual key setup",
              ],
              [
                "02",
                "Run Live Scrapers",
                "Execute isolated Actor containers & live datasets on demand",
              ],
              [
                "03",
                "Hire Peer Agents",
                "Delegate multi-step tasks with verified on-chain proof",
              ],
              [
                "04",
                "Pay Only Per Call",
                "Micropayments billed per execution with auto-refund",
              ],
            ].map(([number, title, detail], index) => (
              <div
                key={number}
                className="hero-enter"
                style={enterDelay(380 + index * 70)}
              >
                <dt>{number}</dt>
                <dd>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="landing-architecture"
          aria-labelledby="architecture-title"
        >
          <ScrollReveal>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Production Architecture</p>
                <h2 id="architecture-title">
                  Autonomous Execution Under Strict Control
                </h2>
              </div>
              <p>
                Give AI agents real purchasing power without leaking vendor
                keys, custodying open treasuries, or trusting unverified code.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={70}>
            <CommerceEngineShowcase />
          </ScrollReveal>
        </section>

        <section
          className="landing-modalities"
          aria-labelledby="modalities-title"
        >
          <ScrollReveal>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Unified Model · What Is a Facet</p>
                <h2 id="modalities-title">
                  API, Actor &amp; Agent — All Are Facets
                </h2>
              </div>
              <p>
                Whether wrapping a REST service, deploying serverless
                containers, or delegating to specialist AI, every capability
                becomes a <strong>Facet</strong> with unified discovery, x402
                billing, and cryptographic receipts.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={60}>
            <div
              className="facet-taxonomy-bar"
              aria-label="Unified Facet standard"
            >
              <div className="facet-taxonomy-core">
                <span className="facet-taxonomy-pill">FACET</span>
                <strong>Universal Standard Across All Three Types</strong>
              </div>
              <ul className="facet-taxonomy-traits">
                <li>Typed Schema Contract</li>
                <li>Scoped Grant Billing</li>
                <li>x402 Settlement</li>
                <li>On-Chain Verification</li>
              </ul>
            </div>
          </ScrollReveal>

          <div className="modality-grid">
            {MODALITIES.map(
              (
                { index, meta, runtimeSubtitle, description, highlights },
                cardIndex,
              ) => (
                <ScrollReveal
                  key={meta.type}
                  className={`modality-card ${meta.accentClass}`}
                  delayMs={cardIndex * 100}
                >
                  <div className="modality-card-top">
                    <span className="modality-index">{index}</span>
                    <span className={`badge-type badge-${meta.accentClass}`}>
                      {meta.glyph} {meta.facetTag}
                    </span>
                  </div>
                  <h3>{meta.shortLabel}</h3>
                  <p className="modality-subtitle">{runtimeSubtitle}</p>
                  <p className="modality-desc">{description}</p>
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
                </ScrollReveal>
              ),
            )}
          </div>
        </section>

        <section className="landing-showcase" aria-labelledby="showcase-title">
          <ScrollReveal>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Quickstart · Ready in Seconds</p>
                <h2 id="showcase-title">Connect Any Agent in Seconds</h2>
              </div>
              <p>
                Copy one setup prompt straight into your coding assistant, or
                run the manual CLI, spending grant, MCP, and SDK commands step
                by step.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={70}>
            <LandingQuickstart />
          </ScrollReveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
