import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  ERC8004_IDENTITY_REGISTRY,
  FACET_CATEGORIES_BY_TYPE,
  FUJI_CONTRACTS,
  STORE_CATEGORY_FILTERS,
  formatAtomicFusd,
  getCategoriesForFacetType,
  getCategoryLabel,
  getCategoryOptionsWithCurrent,
  getFacetTypeMeta,
  getStoreCategoriesForType,
  isValidEvmAddress,
  isValidTxHash,
  slugifyName,
  snowtraceAddressUrl,
  snowtraceTxUrl,
  truncateMiddle,
} from "@/lib/facet-ui";
import { bumpSemver, suggestFacetName } from "@/lib/identifiers";

describe("facet-ui helpers", () => {
  it("formats atomic fUSD values accurately without float drift", () => {
    expect(formatAtomicFusd("1000")).toBe("0.001 fUSD");
    expect(formatAtomicFusd("500")).toBe("0.0005 fUSD");
    expect(formatAtomicFusd("1000000")).toBe("1 fUSD");
    expect(formatAtomicFusd("1500000")).toBe("1.5 fUSD");
    expect(formatAtomicFusd("0")).toBe("0 fUSD");
    expect(formatAtomicFusd(undefined)).toBe("0.001 fUSD");
  });

  it("suggests deterministic 4-32 char kebab-case facet names and bumps SemVer", () => {
    expect(slugifyName("VN Gold & FX Scraper!")).toBe("vn-gold-fx-scraper");
    expect(slugifyName("  CoinGecko Market Chart  ")).toBe(
      "coin-gecko-market-chart",
    );
    expect(slugifyName("---")).toBe("custom-facet");
    expect(suggestFacetName("ab")).toBe("ab-fct");
    expect(suggestFacetName("A".repeat(48)).length).toBe(32);

    expect(bumpSemver("1.0.0", "patch")).toBe("1.0.1");
    expect(bumpSemver("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpSemver("1.2.3", "major")).toBe("2.0.0");
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
    expect(getFacetTypeMeta("API")).toMatchObject({
      badge: "API",
      shortLabel: "API",
      fullLabel: "API",
      studioHref: "/studio/api",
    });
    expect(getFacetTypeMeta("ACTOR")).toMatchObject({
      badge: "ACTOR",
      shortLabel: "Actor",
      fullLabel: "Actor",
      studioHref: "/studio/actor",
    });
    expect(getFacetTypeMeta("AGENT")).toMatchObject({
      badge: "AGENT",
      shortLabel: "Agent",
      fullLabel: "Agent",
      studioHref: "/studio/agent",
    });

    expect(FACET_CATEGORIES_BY_TYPE.API).toHaveLength(6);
    expect(FACET_CATEGORIES_BY_TYPE.ACTOR).toHaveLength(6);
    expect(FACET_CATEGORIES_BY_TYPE.AGENT).toHaveLength(6);
    for (const typeKey of ["API", "ACTOR", "AGENT"] as const) {
      const list = getCategoriesForFacetType(typeKey);
      expect(list).toHaveLength(6);
      expect(list.at(-1)).toEqual({ slug: "others", label: "Others" });
    }

    expect(STORE_CATEGORY_FILTERS.ALL.map((c) => c.slug)).toContain("others");
    expect(STORE_CATEGORY_FILTERS.API).toEqual([
      { slug: "", label: "All" },
      ...FACET_CATEGORIES_BY_TYPE.API,
    ]);
    expect(STORE_CATEGORY_FILTERS.ACTOR).toEqual([
      { slug: "", label: "All" },
      ...FACET_CATEGORIES_BY_TYPE.ACTOR,
    ]);
    expect(STORE_CATEGORY_FILTERS.AGENT).toEqual([
      { slug: "", label: "All" },
      ...FACET_CATEGORIES_BY_TYPE.AGENT,
    ]);

    expect(getCategoryLabel("social", "API")).toBe("Social");
    expect(getCategoryLabel("social", "ACTOR")).toBe("Social & News");
    expect(getCategoryLabel("a2a-agents", "AGENT")).toBe("Multi-Task");
    expect(getCategoryLabel("others", "ACTOR")).toBe("Others");
    expect(getCategoryLabel("", "ACTOR")).toBe("Uncategorized");
    expect(getCategoryOptionsWithCurrent("ACTOR", "")).toEqual(
      FACET_CATEGORIES_BY_TYPE.ACTOR,
    );
    expect(getStoreCategoriesForType(undefined).length).toBeGreaterThan(2);
  });

  it("renders a remediation banner when Clerk account fails 409 USERNAME_REQUIRED", () => {
    const markup = renderToStaticMarkup(
      <ProviderSelectorBar
        workspace={{
          user: null,
          username: "",
          walletAddress: null,
          walletVerified: false,
          loading: false,
          authRequired: false,
          usernameRequired: true,
          error: "Username required",
          refresh: async () => null,
        }}
      />,
    );
    expect(markup).toContain("Username Format Required");
    expect(markup).toContain(
      "lowercase letters (a–z), numbers (0–9), and hyphens (-)",
    );
    expect(markup).toContain("alice-labs");
    expect(markup).not.toContain("^[a-z0-9]");
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
    expect(markup).not.toMatch(/apify|rapidapi/iu);
    expect(markup).toContain('href="/docs"');
    expect(markup).not.toContain(">Home<");
    expect(markup).toContain("nav-active");
  });

  it("renders SiteFooter with Avalanche branding and links to Store, Studio, Docs, and Faucet", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);
    expect(markup).toContain("Avalanche");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain('href="/docs"');
    expect(markup).toContain('href="/faucet"');
    expect(markup).toContain(">Faucet<");
    expect(markup).not.toMatch(/\bfuji\b/iu);
    expect(markup).not.toMatch(/\.<\/span>/u);
    expect(markup).not.toMatch(/apify|rapidapi/iu);
  });
});
