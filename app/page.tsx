import { FacetRow } from "@/components/facet-row";
import { PublishPreviewDialog } from "@/components/publish-preview-dialog";
import { ProviderImportWorkspace } from "@/components/provider-import-workspace";
import { demoFacets } from "@/lib/demo-facets";

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="FACET home">
          FACET<span aria-hidden="true">/</span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="nav-active" href="#store">
            Store
          </a>
          <a href="#provider-console">Providers</a>
          <a href="#docs">Docs</a>
        </nav>
        <span className="environment">Local</span>
      </header>

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
            A machine-readable exchange where developers publish external APIs
            and agents discover how to use them.
          </p>
        </div>
        <div className="hero-actions">
          <PublishPreviewDialog />
          <a className="button button-ghost" href="#store">
            Browse local catalog <span aria-hidden="true">↓</span>
          </a>
        </div>
        <dl className="hero-sequence" aria-label="FACET workflow">
          {[
            ["01", "Discover"],
            ["02", "Verify"],
            ["03", "Execute"],
            ["04", "Transact"],
          ].map(([number, label]) => (
            <div key={number}>
              <dt>{number}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="store" id="store" aria-labelledby="store-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public catalog / local demo</p>
            <h2 id="store-title">Facet Store</h2>
          </div>
          <p>
            Seed records are clearly marked demo data until the Control API
            catalog endpoint lands.
          </p>
        </div>

        <form className="search" role="search">
          <label htmlFor="facet-search">
            What should your agent be able to do?
          </label>
          <div className="search-control">
            <input
              id="facet-search"
              name="q"
              type="search"
              placeholder="e.g. inspect an Avalanche token"
            />
            <button type="submit" aria-label="Search Facets">
              Search <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>

        <div className="catalog-layout">
          <aside className="filter-rail" aria-label="Catalog filters">
            <p>Filter / 02</p>
            <fieldset>
              <legend>Lifecycle</legend>
              <label>
                <input type="checkbox" defaultChecked /> Published
              </label>
              <label>
                <input type="checkbox" defaultChecked /> Draft
              </label>
            </fieldset>
            <fieldset>
              <legend>Authentication</legend>
              <label>
                <input type="checkbox" /> API key
              </label>
              <label>
                <input type="checkbox" /> Bearer
              </label>
            </fieldset>
          </aside>
          <div className="results" aria-live="polite">
            <div className="results-header">
              <span>02 demo Facets</span>
              <span>Sorted / recently updated</span>
            </div>
            {demoFacets.map((facet) => (
              <FacetRow facet={facet} key={facet.id} />
            ))}
          </div>
        </div>
      </section>

      <ProviderImportWorkspace />

      <footer id="docs">
        <span>FACET / MVP v0.1</span>
        <span>Discover. Verify. Execute. Transact.</span>
      </footer>
    </main>
  );
}
