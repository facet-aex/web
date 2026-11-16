import type { PublicFacet } from "@/lib/public-catalog";

function typeLabel(facetType?: PublicFacet["facetType"]): string {
  if (facetType === "HOSTED_ACTOR") return "Docker Actor";
  if (facetType === "AUTONOMOUS_AGENT") return "ERC-8004 Agent";
  return "HTTP API";
}

function priceLabel(facet: PublicFacet): string {
  if (!facet.pricing) return "0.001 fUSD";
  const amount = Number(facet.pricing.priceAtomic) / 1_000_000;
  const unit = facet.pricing.model === "PAY_PER_RESULT" ? "item" : "run";
  return `${amount} fUSD / ${unit}`;
}

export function FacetRow({ facet }: { facet: PublicFacet }) {
  return (
    <article className="facet-row" aria-labelledby={`${facet.id}-title`}>
      <div className="facet-index" aria-hidden="true">
        {facet.id.slice(-2)}
      </div>
      <div className="facet-main">
        <div className="facet-kicker">
          <span className="badge-type">{typeLabel(facet.facetType)}</span>
          <span>{facet.category}</span>
          <span>{facet.method}</span>
          {facet.agentMeta ? (
            <span className="badge-trust">
              ERC-8004 #{facet.agentMeta.erc8004TokenId}
            </span>
          ) : null}
          {facet.actorMeta ? (
            <span className="badge-digest">
              {facet.actorMeta.imageDigest.slice(0, 18)}…
            </span>
          ) : null}
        </div>
        <h3 id={`${facet.id}-title`}>{facet.name}</h3>
        <p>{facet.description}</p>
      </div>
      <dl className="facet-meta">
        <div>
          <dt>Provider</dt>
          <dd>{facet.provider.name}</dd>
        </div>
        <div>
          <dt>Interface</dt>
          <dd>v{facet.displayVersion}</dd>
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
      <a
        className="row-action"
        href={`/facets/${facet.id}`}
        aria-label={`Inspect ${facet.name}`}
      >
        Inspect &amp; Run <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
