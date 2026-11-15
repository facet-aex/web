import type { PublicFacet } from "@/lib/public-catalog";

export function FacetRow({ facet }: { facet: PublicFacet }) {
  return (
    <article className="facet-row" aria-labelledby={`${facet.id}-title`}>
      <div className="facet-index" aria-hidden="true">
        {facet.id.slice(-2)}
      </div>
      <div className="facet-main">
        <div className="facet-kicker">
          <span>{facet.category}</span>
          <span>{facet.method}</span>
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
        Inspect <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
