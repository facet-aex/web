import Image from "next/image";

import { FacetRow } from "@/components/facet-row";
import { PublishPreviewDialog } from "@/components/publish-preview-dialog";
import { ProviderImportWorkspace } from "@/components/provider-import-workspace";
import { getPublicFacets } from "@/lib/public-catalog";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const facets = await getPublicFacets(q.slice(0, 120));
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="FACET home">
          <Image src="/facet-logo.svg" alt="" width={32} height={32} />
          FACET
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
          <p>Published APIs available to agents through FACET.</p>
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
              placeholder="e.g. Bitcoin historical price"
            />
            <button type="submit" aria-label="Search Facets">
              Search <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>

        <div className="catalog-layout">
          <aside className="filter-rail" aria-label="How agents use FACET">
            <p>For agents</p>
            <ol>
              <li>Search for a capability.</li>
              <li>Read its input contract.</li>
              <li>Call through FACET MCP.</li>
            </ol>
            <small>Only published public Facets appear here.</small>
          </aside>
          <div className="results" aria-live="polite">
            <div className="results-header">
              <span>{facets.length} published Facets</span>
              <span>Sorted / recently published</span>
            </div>
            {facets.map((facet) => (
              <FacetRow facet={facet} key={facet.id} />
            ))}
            {facets.length === 0 && <p>No published Facets found.</p>}
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
