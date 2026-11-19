import Link from "next/link";

import {
  formatAtomicFusd,
  getCategoryLabel,
  getFacetTypeMeta,
} from "@/lib/facet-ui";
import type { PublicFacet } from "@/lib/public-catalog";

function priceLabel(facet: PublicFacet): string {
  if (!facet.pricing) return "0.001 fUSD";
  const unit = facet.pricing.model === "PAY_PER_RESULT" ? "item" : "run";
  return `${formatAtomicFusd(facet.pricing.priceAtomic)} / ${unit}`;
}

export function FacetRow({ facet }: { facet: PublicFacet }) {
  const meta = getFacetTypeMeta(facet.facetType);
  const titleId = `${facet.provider}-${facet.facetName}-title`;

  return (
    <article
      className={`facet-row ${meta.accentClass}`}
      aria-labelledby={titleId}
    >
      <div className="facet-index" aria-hidden="true">
        <span className="facet-type-glyph">{meta.glyph}</span>
        <span className="facet-type-code">{meta.badge}</span>
        <span className="facet-short-id">
          {facet.facetName.slice(-2).toUpperCase()}
        </span>
      </div>
      <div className="facet-main">
        <div className="facet-kicker">
          <span className={`badge-type badge-${meta.accentClass}`}>
            {meta.facetTag}
          </span>
          <span className="kicker-chip">
            {getCategoryLabel(facet.category, facet.facetType)}
          </span>
          {facet.facetType === "ACTOR" && facet.actorMeta ? (
            <>
              <span className="kicker-chip">{facet.actorMeta.runtime}</span>
              <span className="badge-digest">
                {facet.actorMeta.imageDigest.slice(0, 15)}…
                {facet.actorMeta.registryVerified ? " ✓" : ""}
              </span>
            </>
          ) : facet.facetType === "AGENT" && facet.agentMeta ? (
            <>
              <span className="badge-trust">
                Identity #{facet.agentMeta.erc8004TokenId}
              </span>
              <span className="kicker-chip">{facet.agentMeta.taskKind}</span>
            </>
          ) : (
            <>
              <span className="kicker-chip">{facet.method}</span>
              <span className="kicker-chip">Gateway Proxy</span>
            </>
          )}
        </div>
        <h3 id={titleId}>{facet.facetDisplayName}</h3>
        <p>{facet.description}</p>
      </div>
      <dl className="facet-meta">
        <div>
          <dt>Provider</dt>
          <dd>{facet.provider}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>v{facet.version}</dd>
        </div>
        <div>
          <dt>x402 Price</dt>
          <dd>{priceLabel(facet)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className="status status-published">Published</span>
          </dd>
        </div>
      </dl>
      <Link
        className="row-action"
        href={`/facets/${encodeURIComponent(facet.provider)}/${encodeURIComponent(facet.facetName)}`}
        aria-label={`Inspect ${facet.facetDisplayName}`}
      >
        <span>{meta.actionLabel}</span>
        <span aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}
