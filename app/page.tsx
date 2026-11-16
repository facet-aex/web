import Image from "next/image";

import { ActorAgentStudio } from "@/components/actor-agent-studio";
import { ClerkAuthBar } from "@/components/clerk-auth-bar";
import { FacetRow } from "@/components/facet-row";
import { PublishPreviewDialog } from "@/components/publish-preview-dialog";
import { ProviderImportWorkspace } from "@/components/provider-import-workspace";
import { getPublicFacets, type FacetType } from "@/lib/public-catalog";

const TYPE_FILTERS: Array<{
  label: string;
  value: FacetType | "";
  category?: string;
}> = [
  { label: "All Capabilities", value: "" },
  { label: "Hosted Actors (Docker)", value: "HOSTED_ACTOR" },
  { label: "A2A Agents (ERC-8004)", value: "AUTONOMOUS_AGENT" },
  { label: "External APIs", value: "EXTERNAL_HTTP_API" },
  { label: "Vietnamese Data", value: "", category: "vietnamese-data" },
];

function isFacetType(value: string): value is FacetType {
  return (
    value === "HOSTED_ACTOR" ||
    value === "AUTONOMOUS_AGENT" ||
    value === "EXTERNAL_HTTP_API"
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; category?: string }>;
}) {
  const { q = "", type = "", category = "" } = await searchParams;
  const activeType: FacetType | "" = isFacetType(type) ? type : "";
  const facets = await getPublicFacets(q.slice(0, 120), {
    ...(activeType ? { type: activeType } : {}),
    ...(category ? { category: category.slice(0, 80) } : {}),
  });

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
          <a href="#actor-studio">Actor &amp; A2A Studio</a>
          <a href="#provider-console">OpenAPI Console</a>
          <a href="#docs">Docs</a>
        </nav>
        <ClerkAuthBar
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        />
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="constellation" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">
            Federated Agent Capability Exchange &amp; Trust — ActorBazaar ×
            ERC-8004 × x402
          </p>
          <h1 id="hero-title">
            Find the missing
            <span>capability.</span>
          </h1>
          <p className="hero-intro">
            A multi-modal Avalanche marketplace unifying Docker Hosted Actors,
            ERC-8004 Autonomous A2A Agents, and External HTTP APIs with instant
            x402 settlement and on-chain receipts.
          </p>
        </div>
        <div className="hero-actions">
          <PublishPreviewDialog />
          <a className="button button-ghost" href="#store">
            Browse live catalog <span aria-hidden="true">↓</span>
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
            <p className="eyebrow">Public catalog / Fuji x402</p>
            <h2 id="store-title">Facet Store</h2>
          </div>
          <p>
            Published Docker Actors, ERC-8004 A2A Agents, and External APIs
            ready for human playground or MCP agent invocation.
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
              defaultValue={q}
              placeholder="e.g. gold price, tin tức Việt Nam, market analyst"
            />
            <button type="submit" aria-label="Search Facets">
              Search <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="filter-chips" aria-label="Filter by capability type">
            {TYPE_FILTERS.map((filter) => {
              const params = new URLSearchParams();
              if (q) params.set("q", q);
              if (filter.value) params.set("type", filter.value);
              if (filter.category) params.set("category", filter.category);
              const href = params.toString()
                ? `/?${params.toString()}#store`
                : "/#store";
              const isActive =
                activeType === filter.value &&
                (filter.category ?? "") === category;
              return (
                <a
                  key={filter.label}
                  href={href}
                  className={`filter-chip ${isActive ? "filter-chip-active" : ""}`}
                >
                  {filter.label}
                </a>
              );
            })}
          </div>
        </form>

        <div className="catalog-layout">
          <aside className="filter-rail" aria-label="How agents use FACET">
            <p>Multi-Modal Flow</p>
            <ol>
              <li>Search Actor, A2A Agent, or API.</li>
              <li>Inspect schema &amp; on-chain digest / ERC-8004 ID.</li>
              <li>Pay fUSD over x402 &amp; inspect Dataset + ReceiptLog.</li>
            </ol>
            <small>
              Compatible with MCP (`search_facets`, `get_facet`, `invoke_facet`)
              and browser Playground.
            </small>
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

      <section className="actor-studio-section" id="actor-studio">
        <ActorAgentStudio />
      </section>

      <ProviderImportWorkspace />

      <footer id="docs">
        <span>FACET / ActorBazaar × ERC-8004 × x402</span>
        <span>Discover. Verify. Execute. Transact.</span>
      </footer>
    </main>
  );
}
