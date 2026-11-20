import Link from "next/link";

import { DOCS_TOC_GROUPS } from "@/components/docs/docs-data";
import { DocsPartAgentGuide } from "@/components/docs/docs-part-agent-guide";
import { DocsPartOverview } from "@/components/docs/docs-part-overview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function DocsPage() {
  return (
    <div className="page-shell">
      <SiteHeader activeSection="docs" />
      <main className="docs-page">
        <header className="section-heading docs-hero">
          <div>
            <p className="eyebrow">User &amp; Agent Guide</p>
            <h1 className="page-title">FACET Documentation</h1>
          </div>
        </header>

        <div className="docs-layout">
          <aside className="docs-toc" aria-label="Documentation sections">
            <p className="eyebrow">Contents</p>
            <div className="docs-toc-groups">
              {DOCS_TOC_GROUPS.map((group) => (
                <div className="docs-toc-group" key={group.id}>
                  <p className="docs-toc-group-label">{group.label}</p>
                  <nav aria-label={group.label}>
                    {group.items.map((section) => (
                      <a key={section.id} href={`#${section.id}`}>
                        {section.label}
                      </a>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
            <div className="docs-toc-cta">
              <Link className="button button-primary" href="/faucet">
                Claim Test fUSD <span aria-hidden="true">↗</span>
              </Link>
              <Link className="button button-secondary" href="/store">
                Browse Facet Store <span aria-hidden="true">↗</span>
              </Link>
              <Link className="button button-ghost" href="/studio">
                Open Studio <span aria-hidden="true">→</span>
              </Link>
            </div>
          </aside>

          <div className="docs-content">
            <DocsPartOverview />
            <DocsPartAgentGuide />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
