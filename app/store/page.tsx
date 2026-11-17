import Link from "next/link";

import { FacetRow } from "@/components/facet-row";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FACET_TYPE_META, getStoreCategoriesForType } from "@/lib/facet-ui";
import { getPublicFacets, type FacetType } from "@/lib/public-catalog";

const TYPE_TABS: Array<{
  label: string;
  value: FacetType | "";
  badge: string;
  contextTitle: string;
  hint: string;
}> = [
  {
    label: "All Facets",
    value: "",
    badge: "ALL",
    contextTitle: "Facet · All Types",
    hint: "Showing every published Facet—API, Actor, and Agent—with inspectable schemas and x402 pricing.",
  },
  {
    label: "API",
    value: "EXTERNAL_HTTP_API",
    badge: "API",
    contextTitle: FACET_TYPE_META.EXTERNAL_HTTP_API.facetTag,
    hint: FACET_TYPE_META.EXTERNAL_HTTP_API.description,
  },
  {
    label: "Actor",
    value: "HOSTED_ACTOR",
    badge: "ACTOR",
    contextTitle: FACET_TYPE_META.HOSTED_ACTOR.facetTag,
    hint: FACET_TYPE_META.HOSTED_ACTOR.description,
  },
  {
    label: "Agent",
    value: "AUTONOMOUS_AGENT",
    badge: "AGENT",
    contextTitle: FACET_TYPE_META.AUTONOMOUS_AGENT.facetTag,
    hint: FACET_TYPE_META.AUTONOMOUS_AGENT.description,
  },
];

function isFacetType(value: string): value is FacetType {
  return (
    value === "HOSTED_ACTOR" ||
    value === "AUTONOMOUS_AGENT" ||
    value === "EXTERNAL_HTTP_API"
  );
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; category?: string }>;
}) {
  const { q = "", type = "", category = "" } = await searchParams;
  const activeType: FacetType | "" = isFacetType(type) ? type : "";
  const categoryOptions = getStoreCategoriesForType(activeType);
  const facets = await getPublicFacets(q.slice(0, 120), {
    ...(activeType ? { type: activeType } : {}),
    ...(category ? { category: category.slice(0, 80) } : {}),
  });

  const activeTab =
    TYPE_TABS.find((tab) => tab.value === activeType) ?? TYPE_TABS[0]!;

  const activeStudioLink = activeType
    ? FACET_TYPE_META[activeType].studioHref
    : "/studio";
  const activeStudioLabel = activeType
    ? `Publish ${FACET_TYPE_META[activeType].shortLabel}`
    : "Publish Facet";

  return (
    <div className="page-shell">
      <SiteHeader activeSection="store" />
      <main className="store" id="store">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public Marketplace / Avalanche Fuji x402</p>
            <h1 className="page-title">Facet Store</h1>
          </div>
          <p>
            Every entry in Store is a <strong>Facet</strong>—implemented as an{" "}
            <strong>API</strong>, an <strong>Actor</strong>, or an{" "}
            <strong>Agent</strong>—with inspectable input schemas, fUSD pricing,
            and verifiable on-chain receipts.
          </p>
        </div>

        <div
          className="store-modality-strip"
          role="navigation"
          aria-label="Filter by Facet type"
        >
          {TYPE_TABS.map((tab) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (tab.value) params.set("type", tab.value);
            const href = params.toString()
              ? `/store?${params.toString()}`
              : "/store";
            const isActive = activeType === tab.value;
            return (
              <Link
                key={tab.label}
                href={href}
                className={`modality-tab ${isActive ? "modality-tab-active" : ""}`}
              >
                <span className="modality-tab-badge">{tab.badge}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="store-context-banner">
          <div className="store-context-copy">
            <strong>{activeTab.contextTitle}</strong>
            <p>{activeTab.hint}</p>
          </div>
          <Link className="button button-secondary" href={activeStudioLink}>
            {activeStudioLabel} <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div
          className="store-category-bar"
          role="navigation"
          aria-label="Filter by category"
        >
          <span className="store-category-label">
            {activeType
              ? `${FACET_TYPE_META[activeType].shortLabel} Categories`
              : "Facet Categories"}
          </span>
          {categoryOptions.map((option) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (activeType) params.set("type", activeType);
            if (option.slug) params.set("category", option.slug);
            const href = params.toString()
              ? `/store?${params.toString()}`
              : "/store";
            const isSelected = category === option.slug;
            return (
              <Link
                key={`${activeType || "ALL"}-${option.slug || "all"}`}
                href={href}
                className={`category-chip${isSelected ? " category-chip-active" : ""}`}
                aria-current={isSelected ? "true" : undefined}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        <form className="search" action="/store" method="get" role="search">
          <label htmlFor="facet-search">
            Which Facet does your workflow need?
          </label>
          {activeType ? (
            <input type="hidden" name="type" value={activeType} />
          ) : null}
          {category ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
          <div className="search-control">
            <input
              id="facet-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="e.g. gold price, Vietnam fintech news, token snapshot, analyst agent"
            />
            <button type="submit" aria-label="Search Facets">
              Search <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>

        <div className="catalog-layout">
          <aside className="filter-rail" aria-label="Facet guide">
            <p>What is a Facet?</p>
            <small className="rail-intro-note">
              Every listing in Store is a <strong>Facet</strong>—one standard
              contract across three runtime types:
            </small>
            <dl className="rail-legend">
              <div>
                <dt>⇄ Facet · API</dt>
                <dd>
                  External REST endpoint proxied by Gateway with SSRF pinning.
                </dd>
              </div>
              <div>
                <dt>▣ Facet · Actor</dt>
                <dd>
                  Node.js 22 Docker sandbox returning Dataset + imageDigest.
                </dd>
              </div>
              <div>
                <dt>◈ Facet · Agent</dt>
                <dd>
                  ERC-8004 on-chain identity executing tasks with citations.
                </dd>
              </div>
            </dl>
            <p className="rail-subhead">Execution Flow</p>
            <ol>
              <li>Pick a Facet (API, Actor, or Agent).</li>
              <li>Inspect schema &amp; on-chain proof.</li>
              <li>Pay fUSD over x402 &amp; verify receipt.</li>
            </ol>
            <small>
              Need programmatic access? See the{" "}
              <Link className="explorer-link" href="/docs#agent-guide">
                MCP &amp; SDK guide
              </Link>
              .
            </small>
          </aside>

          <div className="results" aria-live="polite">
            <div className="results-header">
              <span>{facets.length} published Facets</span>
              <span>
                {q || activeType || category ? (
                  <Link className="explorer-link" href="/store">
                    Reset filters
                  </Link>
                ) : (
                  "Sorted / recently published"
                )}
              </span>
            </div>
            {facets.map((facet) => (
              <FacetRow facet={facet} key={facet.id} />
            ))}
            {facets.length === 0 ? (
              <div className="empty-catalog">
                <p>No published Facets match the current filters.</p>
                <div className="empty-catalog-actions">
                  <Link className="button button-ghost" href="/store">
                    Clear all filters
                  </Link>
                  <Link className="button button-primary" href="/studio">
                    Publish Facet <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
