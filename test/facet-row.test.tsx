import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FacetRow } from "@/components/facet-row";
import type { PublicFacet } from "@/lib/public-catalog";

describe("FacetRow", () => {
  it("exposes provider, interface and lifecycle status without relying on color alone", () => {
    const facet: PublicFacet = {
      id: "00000000-0000-4000-8000-000000000001",
      versionId: "00000000-0000-4000-8000-000000000002",
      slug: "token-snapshot",
      name: "Avalanche token snapshot",
      description: "Token details",
      category: "Blockchain data",
      tags: [],
      provider: {
        id: "00000000-0000-4000-8000-000000000003",
        name: "Northstar Labs",
        slug: "northstar",
      },
      displayVersion: "0.1.0",
      method: "GET",
      inputSchema: {},
      outputSchema: {},
      publishedAt: "2026-11-10T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetRow facet={facet} />);

    expect(markup).toContain("Northstar Labs");
    expect(markup).toContain("Published");
    expect(markup).toContain("0.1.0");
    expect(markup).toContain('aria-label="Inspect Avalanche token snapshot"');
  });
});
