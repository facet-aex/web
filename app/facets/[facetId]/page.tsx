import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentIdentityCard } from "@/components/agent-identity-card";
import { FacetPlayground } from "@/components/facet-playground";
import { RegistryVerificationForm } from "@/components/registry-verification-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  formatAtomicFusd,
  getFacetTypeMeta,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import { getPublicFacet } from "@/lib/public-catalog";

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

export default async function FacetDetailPage({
  params,
}: {
  params: Promise<{ facetId: string }>;
}) {
  const { facetId } = await params;
  if (!/^[0-9a-f-]{36}$/iu.test(facetId)) notFound();
  const facet = await getPublicFacet(facetId);
  if (!facet) notFound();

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
          <span>{facet.name}</span>
        </nav>

        <div className="detail-header">
          <div>
            <p className="eyebrow">
              {meta.glyph} {meta.facetTag} · {facet.provider.name} ·{" "}
              {facet.category}
            </p>
            <h1>{facet.name}</h1>
            <p className="detail-description">{facet.description}</p>
          </div>
          <span className={`badge-type badge-${meta.accentClass}`}>
            {meta.facetTag}
          </span>
        </div>

        {facet.facetType === "AUTONOMOUS_AGENT" && facet.agentMeta ? (
          <AgentIdentityCard
            facetId={facet.id}
            name={facet.name}
            slug={facet.slug}
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
            <dd>v{facet.displayVersion}</dd>
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
            <dt>Facet ID</dt>
            <dd>{facet.id}</dd>
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
            facetId={facet.id}
            initialTxHash={
              facet.actorMeta?.registryTxHash ??
              facet.agentMeta?.registryTxHash ??
              ""
            }
          />
        ) : null}

        <FacetPlayground facet={facet} />

        <div className="schema-pair">
          <div>
            <h2>Input schema</h2>
            <pre className="json-pre">
              {JSON.stringify(facet.inputSchema, null, 2)}
            </pre>
          </div>
          <div>
            <h2>Output schema</h2>
            <pre className="json-pre">
              {JSON.stringify(facet.outputSchema, null, 2)}
            </pre>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
