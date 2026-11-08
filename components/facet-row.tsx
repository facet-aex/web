import type { DemoFacet } from "@/lib/demo-facets";

export function FacetRow({ facet }: { facet: DemoFacet }) {
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
          <dd>{facet.provider}</dd>
        </div>
        <div>
          <dt>Interface</dt>
          <dd>
            v{facet.version} · {facet.auth}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`status status-${facet.status.toLowerCase()}`}>
              {facet.status}
            </span>
          </dd>
        </div>
      </dl>
      <a
        className="row-action"
        href={`#${facet.id}`}
        aria-label={`Inspect ${facet.name}`}
      >
        Inspect <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}
