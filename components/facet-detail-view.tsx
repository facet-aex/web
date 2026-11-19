import Link from "next/link";

import { AgentIdentityCard } from "@/components/agent-identity-card";
import { FacetPlayground } from "@/components/facet-playground";
import { RegistryVerificationForm } from "@/components/registry-verification-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  formatAtomicFusd,
  getCategoryLabel,
  getFacetTypeMeta,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import type { PublicFacet } from "@/lib/public-catalog";

function extractInputFieldNames(schema: unknown): string[] {
  if (
    typeof schema !== "object" ||
    schema === null ||
    !("properties" in schema) ||
    typeof schema.properties !== "object" ||
    schema.properties === null
  ) {
    return [];
  }
  return Object.keys(schema.properties);
}

export function FacetDetailView({ facet }: { facet: PublicFacet }) {
  const meta = getFacetTypeMeta(facet.facetType);
  const priceFusd = facet.pricing
    ? `${formatAtomicFusd(facet.pricing.priceAtomic)} (${facet.pricing.model})`
    : "0.001 fUSD (PAY_PER_RUN)";
  const inputFields = extractInputFieldNames(facet.inputSchema);

  return (
    <div className="page-shell">
      <SiteHeader activeSection="store" />
      <main className="store facet-detail-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link className="back-link" href="/store">
            Facet Store
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="back-link" href={meta.storeHref}>
            {meta.shortLabel}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{facet.facetDisplayName}</span>
        </nav>

        <div className="detail-header">
          <div>
            <p className="eyebrow">
              {meta.glyph} {meta.facetTag} · {facet.provider} ·{" "}
              {getCategoryLabel(facet.category, facet.facetType)}
            </p>
            <h1>{facet.facetDisplayName}</h1>
            <p className="detail-description">{facet.description}</p>
          </div>
          <span className={`badge-type badge-${meta.accentClass}`}>
            {meta.facetTag}
          </span>
        </div>

        {facet.facetType === "AGENT" && facet.agentMeta ? (
          <AgentIdentityCard
            provider={facet.provider}
            facetName={facet.facetName}
            facetDisplayName={facet.facetDisplayName}
            version={facet.version}
            summary={facet.description}
            erc8004Registry={facet.agentMeta.erc8004Registry}
            erc8004TokenId={facet.agentMeta.erc8004TokenId}
            taskKind={facet.agentMeta.taskKind}
            pricingModel={facet.pricing?.model ?? "PAY_PER_RUN"}
            priceAtomic={facet.pricing?.priceAtomic ?? "1000"}
            {...(facet.pricing?.payTo ? { payTo: facet.pricing.payTo } : {})}
            {...(facet.agentMeta.registryVerified !== undefined
              ? { registryVerified: facet.agentMeta.registryVerified }
              : {})}
            {...(facet.agentMeta.registryTxHash
              ? { registryTxHash: facet.agentMeta.registryTxHash }
              : {})}
            inputFields={inputFields}
          />
        ) : null}

        <dl className="detail-meta-grid">
          <div>
            <dt>Version</dt>
            <dd>v{facet.version}</dd>
          </div>
          <div>
            <dt>Invocation Method</dt>
            <dd>{facet.method}</dd>
          </div>
          <div>
            <dt>x402 Pricing (Fuji)</dt>
            <dd>{priceFusd}</dd>
          </div>
          <div>
            <dt>Facet Identifier</dt>
            <dd>
              {facet.provider}/{facet.facetName}
            </dd>
          </div>
          {facet.actorMeta ? (
            <>
              <div>
                <dt>Docker Sandbox Runtime</dt>
                <dd>
                  {facet.actorMeta.runtime} (0.5 vCPU · 128 MB · --read-only ·
                  --network=none)
                </dd>
              </div>
              <div>
                <dt>On-Chain Image Digest</dt>
                <dd>{facet.actorMeta.imageDigest}</dd>
              </div>
              {facet.actorMeta.runnerOciDigest ? (
                <div>
                  <dt>Runner Image Pin</dt>
                  <dd>{facet.actorMeta.runnerOciDigest}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {!facet.actorMeta && !facet.agentMeta ? (
            <div>
              <dt>Gateway Enforcement</dt>
              <dd>SSRF DNS/IP Pinning · Encrypted Secret Isolation</dd>
            </div>
          ) : null}
          {(facet.actorMeta?.registryTxHash ??
          facet.agentMeta?.registryTxHash) ? (
            <div>
              <dt>
                ActorRegistry Tx (
                {(facet.actorMeta?.registryVerified ??
                facet.agentMeta?.registryVerified)
                  ? "Verified on Fuji ✓"
                  : "Unverified Reference"}
                )
              </dt>
              <dd>
                <a
                  className="explorer-link"
                  href={snowtraceTxUrl(
                    facet.actorMeta?.registryTxHash ??
                      facet.agentMeta?.registryTxHash ??
                      "",
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {facet.actorMeta?.registryTxHash ??
                    facet.agentMeta?.registryTxHash}{" "}
                  ↗
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        {(facet.actorMeta || facet.agentMeta) &&
        !(
          facet.actorMeta?.registryVerified ?? facet.agentMeta?.registryVerified
        ) ? (
          <RegistryVerificationForm
            provider={facet.provider}
            facetName={facet.facetName}
            version={facet.version}
            initialTxHash={
              facet.actorMeta?.registryTxHash ??
              facet.agentMeta?.registryTxHash ??
              ""
            }
          />
        ) : null}

        <FacetPlayground facet={facet} />

        <div className="schema-pair">
          <div className="schema-box">
            <h2>Input Schema (JSON Schema)</h2>
            <pre>{JSON.stringify(facet.inputSchema, null, 2)}</pre>
          </div>
          <div className="schema-box">
            <h2>Output Schema (JSON Schema)</h2>
            <pre>{JSON.stringify(facet.outputSchema, null, 2)}</pre>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
