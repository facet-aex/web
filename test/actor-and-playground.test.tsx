import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActorAgentStudio } from "@/components/actor-agent-studio";
import { FacetPlayground } from "@/components/facet-playground";
import type { PublicFacet } from "@/lib/public-catalog";

describe("ActorAgentStudio and FacetPlayground", () => {
  it("renders minimalist 1-step Actor and ERC-8004 A2A Agent Studio", () => {
    const markup = renderToStaticMarkup(<ActorAgentStudio />);
    expect(markup).toContain("Push Node.js Actor or ERC-8004 A2A Agent");
    expect(markup).toContain("VN Gold &amp; FX Scraper");
    expect(markup).toContain("VN Tech &amp; Macro News Extractor");
    expect(markup).toContain("Publish Docker Actor");
  });

  it("auto-generates Input-Schema Form fields from JSON Schema", () => {
    const actorFacet: PublicFacet = {
      id: "00000000-0000-4000-8000-000000000010",
      versionId: "00000000-0000-4000-8000-000000000011",
      slug: "vn-gold-fx-actor",
      name: "VN Gold & FX Scraper",
      description: "Vietnamese gold prices",
      category: "vietnamese-data",
      tags: ["vietnam", "gold"],
      facetType: "HOSTED_ACTOR",
      provider: {
        id: "00000000-0000-4000-8000-000000000012",
        name: "VN Labs",
        slug: "vn-labs",
      },
      displayVersion: "1.0.0",
      method: "POST",
      inputSchema: {
        type: "object",
        properties: {
          brand: { type: "string", enum: ["ALL", "SJC", "DOJI"] },
          limit: { type: "integer", default: 3 },
        },
      },
      outputSchema: { type: "array" },
      pricing: {
        model: "PAY_PER_RUN",
        priceAtomic: "1000",
        assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
        chainId: 43113,
        payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
      },
      publishedAt: "2026-11-16T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetPlayground facet={actorFacet} />);
    expect(markup).toContain("Input-Schema Form");
    expect(markup).toContain('id="field-brand"');
    expect(markup).toContain('id="field-limit"');
    expect(markup).toContain("Pay 0.001 fUSD via x402 &amp; Run");
  });
});
