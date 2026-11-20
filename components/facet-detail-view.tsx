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
import {
  normalizePricingOptions,
  type NormalizedPricingOption,
} from "@/lib/pricing-types";
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

function resolveDetailPricingOptions(
  facet: PublicFacet,
): NormalizedPricingOption[] {
  const normalized = normalizePricingOptions(
    facet.pricing,
    facet.pricingOptions,
  );
  if (
    (!facet.pricingOptions || facet.pricingOptions.length === 0) &&
    facet.pricing?.model === "PAY_PER_RESULT" &&
    normalized[0]
  ) {
    const cap = facet.pricing.maxItemsCap ?? 20;
    const maxAmount =
      facet.pricing.maxAmountAtomic ??
      (BigInt(facet.pricing.priceAtomic) * BigInt(cap)).toString();
    return [
      {
        ...normalized[0],
        maxItemsCap: cap,
        maxAmountAtomic: maxAmount,
      },
    ];
  }
  return normalized;
}

function formatPricingOptionLine(option: NormalizedPricingOption): string {
  const primarySuffix = option.isPrimary ? " (Primary)" : "";
  if (option.model === "PAY_PER_RESULT") {
    const cap = option.maxItemsCap ?? 20;
    return `${option.model}${primarySuffix} · ${formatAtomicFusd(option.priceAtomic)} / item · max ${cap} items (max deposit ${formatAtomicFusd(option.maxAmountAtomic)})`;
  }
  return `${option.model}${primarySuffix} · ${formatAtomicFusd(option.priceAtomic)} / run`;
}

export function FacetDetailView({ facet }: { facet: PublicFacet }) {
  const meta = getFacetTypeMeta(facet.facetType);
  const pricingOptions = resolveDetailPricingOptions(facet);
  const primaryPricing =
    pricingOptions.find((option) => option.isPrimary) ?? pricingOptions[0];
  const inputFields = extractInputFieldNames(facet.inputSchema);

  const registryTxHash =
    facet.actorMeta?.registryTxHash ??
    facet.agentMeta?.registryTxHash ??
    facet.apiMeta?.registryTxHash;
  const registryVerified =
    facet.actorMeta?.registryVerified ??
    facet.agentMeta?.registryVerified ??
    facet.apiMeta?.registryVerified;
  const hasRegistryMetadata = Boolean(
    facet.actorMeta || facet.agentMeta || facet.apiMeta,
  );

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
            pricingModel={primaryPricing?.model ?? "PAY_PER_RUN"}
            priceAtomic={primaryPricing?.priceAtomic ?? "1000"}
            {...(pricingOptions.length > 0 ? { pricingOptions } : {})}
            {...(primaryPricing?.payTo ? { payTo: primaryPricing.payTo } : {})}
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
            <dt>x402 Pricing (Avalanche)</dt>
            <dd>
              {pricingOptions.length > 0 ? (
                <div className="detail-pricing-list">
                  {pricingOptions.map((option) => (
                    <span key={option.model}>
                      {formatPricingOptionLine(option)}
                    </span>
                  ))}
                </div>
              ) : (
                "0.001 fUSD (PAY_PER_RUN)"
              )}
            </dd>
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
          {facet.apiMeta ? (
            <>
              <div>
                <dt>API Endpoint</dt>
                <dd>
                  <code>
                    {facet.apiMeta.method} {facet.apiMeta.pathTemplate}
                  </code>
                </dd>
              </div>
              {facet.apiMeta.datasetPath ? (
                <div>
                  <dt>Dataset Path</dt>
                  <dd>
                    <code>{facet.apiMeta.datasetPath}</code>
                  </dd>
                </div>
              ) : null}
              {facet.apiMeta.staticHeaderNames &&
              facet.apiMeta.staticHeaderNames.length > 0 ? (
                <div>
                  <dt>Static Headers</dt>
                  <dd>{facet.apiMeta.staticHeaderNames.join(", ")}</dd>
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
          {registryTxHash ? (
            <div>
              <dt>
                ActorRegistry Tx (
                {registryVerified
                  ? "Verified on Avalanche ✓"
                  : "Unverified Reference"}
                )
              </dt>
              <dd>
                <a
                  className="explorer-link"
                  href={snowtraceTxUrl(registryTxHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {registryTxHash} ↗
                </a>
              </dd>
            </div>
          ) : registryVerified ? (
            <div>
              <dt>Avalanche Registry</dt>
              <dd>Verified on Avalanche ✓</dd>
            </div>
          ) : null}
        </dl>

        {hasRegistryMetadata && !registryVerified ? (
          <RegistryVerificationForm
            provider={facet.provider}
            facetName={facet.facetName}
            version={facet.version}
            initialTxHash={registryTxHash ?? ""}
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
