"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavSection = "home" | "store" | "studio" | "docs";

const STUDIO_DROPDOWN_ITEMS: Array<{
  href: string;
  badge: string;
  glyph: string;
  title: string;
  subtitle: string;
  accentClass: string;
}> = [
  {
    href: "/studio/api",
    badge: "API",
    glyph: "⇄",
    title: "API",
    subtitle: "Wrap REST endpoints & OpenAPI specs as a Facet",
    accentClass: "modality-api",
  },
  {
    href: "/studio/actor",
    badge: "ACTOR",
    glyph: "▣",
    title: "Actor",
    subtitle: "Publish Docker Node.js modules returning Datasets",
    accentClass: "modality-actor",
  },
  {
    href: "/studio/agent",
    badge: "AGENT",
    glyph: "◈",
    title: "Agent",
    subtitle: "Register ERC-8004 identity & Agent Card",
    accentClass: "modality-agent",
  },
];

function resolveActiveSection(
  pathname: string | null,
  fallback?: NavSection,
): NavSection | undefined {
  if (!pathname) return fallback;
  if (pathname === "/store" || pathname.startsWith("/facets")) return "store";
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/docs")) return "docs";
  if (pathname === "/") return "home";
  return fallback;
}

export function SiteNav({ activeSection }: { activeSection?: NavSection }) {
  const pathname = usePathname();
  const active = resolveActiveSection(pathname, activeSection);
  const [studioOpen, setStudioOpen] = useState(false);

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <Link
        href="/store"
        className={`site-nav-cell${active === "store" ? " nav-active" : ""}`}
        aria-current={active === "store" ? "page" : undefined}
      >
        Store
      </Link>

      <div
        className={`nav-dropdown${studioOpen ? " nav-dropdown-open" : ""}`}
        onMouseEnter={() => setStudioOpen(true)}
        onMouseLeave={() => setStudioOpen(false)}
        onFocus={() => setStudioOpen(true)}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          setStudioOpen(false);
        }}
      >
        <Link
          href="/studio"
          className={`site-nav-cell nav-dropdown-trigger${active === "studio" ? " nav-active" : ""}`}
          aria-current={active === "studio" ? "page" : undefined}
          onClick={() => setStudioOpen(false)}
        >
          <span>Studio</span>
          <span className="nav-chevron" aria-hidden="true">
            ▾
          </span>
        </Link>

        <div
          className="nav-dropdown-menu"
          role="menu"
          aria-label="Choose Facet type to create"
        >
          <div className="nav-dropdown-caption">Publish a Facet</div>
          {STUDIO_DROPDOWN_ITEMS.map((item) => {
            const isCurrent = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={`nav-dropdown-item ${item.accentClass}${isCurrent ? " nav-dropdown-item-active" : ""}`}
                onClick={() => setStudioOpen(false)}
              >
                <span className="nav-dropdown-badge">
                  <span aria-hidden="true">{item.glyph}</span> {item.badge}
                </span>
                <span className="nav-dropdown-copy">
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <Link
        href="/docs"
        className={`site-nav-cell${active === "docs" ? " nav-active" : ""}`}
        aria-current={active === "docs" ? "page" : undefined}
      >
        Docs
      </Link>
    </nav>
  );
}
