import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FacetRow } from "@/components/facet-row";
import type { PublicFacet } from "@/lib/public-catalog";

describe("FacetRow", () => {
  it("renders HTTP API modality cues and action label without relying on color alone", () => {
    const facet: PublicFacet = {
      provider: "northstar-labs",
      facetName: "token-snapshot",
      facetDisplayName: "Avalanche token snapshot",
      description: "Token details",
      category: "Blockchain data",
      tags: [],
      facetType: "API",
      version: "0.1.0",
      method: "GET",
      inputSchema: {},
      outputSchema: {},
      publishedAt: "2026-11-10T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetRow facet={facet} />);

    expect(markup).toContain("northstar-labs");
    expect(markup).toContain("Blockchain data");
    expect(markup).toContain("Published");
    expect(markup).toContain("Facet · API");
    expect(markup).toContain("Inspect API");
    expect(markup).toContain("0.1.0");
    expect(markup).toContain('aria-label="Inspect Avalanche token snapshot"');
  });

  it("renders Hosted Actor container runtime and imageDigest provenance", () => {
    const facet: PublicFacet = {
      provider: "northstar-labs",
      facetName: "vn-gold-fx-actor",
      facetDisplayName: "VN Gold & FX Scraper",
      description: "Gold prices",
      category: "vietnamese-data",
      tags: ["vietnam"],
      facetType: "ACTOR",
      version: "1.0.0",
      method: "POST",
      inputSchema: {},
      outputSchema: {},
      actorMeta: {
        runtime: "nodejs22-alpine-v1",
        imageDigest: `sha256:${"a".repeat(64)}`,
        registryVerified: true,
      },
      publishedAt: "2026-11-16T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetRow facet={facet} />);

    expect(markup).toContain("Facet · Actor");
    expect(markup).toContain("Vietnamese Data");
    expect(markup).toContain("nodejs22-alpine-v1");
    expect(markup).toContain("sha256:aaaaaaaa");
    expect(markup).toContain("Run Actor");
    expect(markup).toContain("modality-actor");
  });

  it("renders A2A Agent ERC-8004 identity and task kind", () => {
    const facet: PublicFacet = {
      provider: "northstar-labs",
      facetName: "vn-market-analyst-agent",
      facetDisplayName: "VN Market Analyst",
      description: "Autonomous analyst",
      category: "a2a-agents",
      tags: ["a2a"],
      facetType: "AGENT",
      version: "1.0.0",
      method: "POST",
      inputSchema: {},
      outputSchema: {},
      agentMeta: {
        erc8004ChainId: 43113,
        erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        erc8004TokenId: "1",
        taskKind: "vn-market-analysis",
        registryVerified: true,
      },
      publishedAt: "2026-11-16T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetRow facet={facet} />);

    expect(markup).toContain("Facet · Agent");
    expect(markup).toContain("Multi-Task");
    expect(markup).toContain("Identity #1");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain("Delegate to Agent");
    expect(markup).toContain("modality-agent");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });
});
