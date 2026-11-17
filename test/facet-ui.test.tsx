import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  ERC8004_IDENTITY_REGISTRY,
  FUJI_CONTRACTS,
  STORE_CATEGORY_FILTERS,
  formatAtomicFusd,
  getFacetTypeMeta,
  getStoreCategoriesForType,
  isValidEvmAddress,
  isValidTxHash,
  slugifyName,
  snowtraceAddressUrl,
  snowtraceTxUrl,
  truncateMiddle,
} from "@/lib/facet-ui";

describe("facet-ui helpers", () => {
  it("formats atomic fUSD values accurately without float drift", () => {
    expect(formatAtomicFusd("1000")).toBe("0.001 fUSD");
    expect(formatAtomicFusd("500")).toBe("0.0005 fUSD");
    expect(formatAtomicFusd("1000000")).toBe("1 fUSD");
    expect(formatAtomicFusd("1500000")).toBe("1.5 fUSD");
    expect(formatAtomicFusd("0")).toBe("0 fUSD");
    expect(formatAtomicFusd(undefined)).toBe("0.001 fUSD");
  });

  it("slugifies names deterministically into kebab-case", () => {
    expect(slugifyName("VN Gold & FX Scraper!")).toBe("vn-gold-fx-scraper");
    expect(slugifyName("  CoinGecko Market Chart  ")).toBe(
      "coingecko-market-chart",
    );
    expect(slugifyName("---")).toBe("custom-facet");
  });

  it("validates EVM addresses and tx hashes and builds Snowtrace URLs", () => {
    expect(isValidEvmAddress(ERC8004_IDENTITY_REGISTRY)).toBe(true);
    expect(isValidEvmAddress("0x123")).toBe(false);
    expect(isValidTxHash(`0x${"a".repeat(64)}`)).toBe(true);
    expect(isValidTxHash("0xabc")).toBe(false);
    expect(snowtraceAddressUrl(FUJI_CONTRACTS.fusd)).toBe(
      `https://testnet.snowtrace.io/address/${FUJI_CONTRACTS.fusd}`,
    );
    expect(snowtraceTxUrl(`0x${"b".repeat(64)}`)).toBe(
      `https://testnet.snowtrace.io/tx/0x${"b".repeat(64)}`,
    );
    expect(truncateMiddle(ERC8004_IDENTITY_REGISTRY, 8, 6)).toBe(
      "0x8004A8…94BD9e",
    );
  });

  it("maps each FacetType to canonical metadata, category filters, and studio routes", () => {
    expect(getFacetTypeMeta("EXTERNAL_HTTP_API")).toMatchObject({
      badge: "API",
      shortLabel: "API",
      fullLabel: "API",
      studioHref: "/studio/api",
    });
    expect(getFacetTypeMeta("HOSTED_ACTOR")).toMatchObject({
      badge: "ACTOR",
      shortLabel: "Actor",
      fullLabel: "Actor",
      studioHref: "/studio/actor",
    });
    expect(getFacetTypeMeta("AUTONOMOUS_AGENT")).toMatchObject({
      badge: "AGENT",
      shortLabel: "Agent",
      fullLabel: "Agent",
      studioHref: "/studio/agent",
    });

    expect(
      STORE_CATEGORY_FILTERS.EXTERNAL_HTTP_API.map((c) => c.label),
    ).toEqual(expect.arrayContaining(["Data", "Social"]));
    expect(STORE_CATEGORY_FILTERS.HOSTED_ACTOR.map((c) => c.label)).toEqual(
      expect.arrayContaining(["Web Scraping", "Vietnamese Data"]),
    );
    expect(STORE_CATEGORY_FILTERS.AUTONOMOUS_AGENT.map((c) => c.label)).toEqual(
      expect.arrayContaining(["Market Analysis", "Research"]),
    );
    expect(getStoreCategoriesForType(undefined).length).toBeGreaterThan(2);
  });
});

describe("SiteHeader and SiteFooter", () => {
  it("renders a 3-item navbar where Studio links to /studio and hover dropdown has only API, Actor, and Agent", () => {
    const markup = renderToStaticMarkup(<SiteHeader activeSection="store" />);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('aria-label="FACET home"');
    expect(markup).toContain('href="/store"');
    expect(markup).toContain(
      '<a class="site-nav-cell nav-dropdown-trigger" href="/studio">',
    );
    expect(markup).toContain('href="/studio/api"');
    expect(markup).toContain('href="/studio/actor"');
    expect(markup).toContain('href="/studio/agent"');
    expect(markup).not.toContain("Studio Overview");
    expect(markup).not.toContain(">⊞ HUB<");
    expect(markup).not.toContain("External HTTP API");
    expect(markup).not.toContain("Hosted Docker Actor");
    expect(markup).not.toContain("ERC-8004 A2A Agent");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
    expect(markup).toContain('href="/docs"');
    expect(markup).not.toContain(">Home<");
    expect(markup).toContain("nav-active");
  });

  it("renders SiteFooter with links to Store, Studio, and Docs", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/studio"');
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
    expect(markup).toContain('href="/docs"');
  });
});
