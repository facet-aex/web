import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActorStudio } from "@/components/actor-studio";
import { AgentIdentityCard } from "@/components/agent-identity-card";
import { AgentStudio } from "@/components/agent-studio";
import { FacetPlayground } from "@/components/facet-playground";
import type { PublicFacet } from "@/lib/public-catalog";

describe("ActorStudio, AgentStudio, and FacetPlayground", () => {
  it("renders Actor Studio with tabs, presets, and Docker sandbox specs", () => {
    const markup = renderToStaticMarkup(<ActorStudio />);

    expect(markup).toContain("Actor Studio");
    expect(markup).not.toContain("Hosted Actor Studio");
    expect(markup).toContain("Blank Actor");
    expect(markup).toContain("VN Gold &amp; FX Scraper");
    expect(markup).toContain("VN Tech &amp; Macro News Extractor");
    expect(markup).toContain("Source &amp; Metadata");
    expect(markup).toContain("Input Schema");
    expect(markup).toContain("Pricing &amp; Payout");
    expect(markup).toContain("facet/node-actor-runner:1.0");
    expect(markup).toContain("--network=none");
    expect(markup).toContain("Publish Actor");
    expect(markup).toContain("Link payout wallet");
    expect(markup).toContain("Run Docker preview");
    expect(markup).toContain("actor-version");
    expect(markup).not.toContain("Pre-Anchored Registry Tx");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders Agent Studio with live On-Chain Agent Card and without unused custom code textarea", () => {
    const markup = renderToStaticMarkup(<AgentStudio />);

    expect(markup).toContain("Agent Studio");
    expect(markup).toContain("VN Market &amp; Macro Analyst");
    expect(markup).toContain("Custom Agent");
    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("AVALANCHE FUJI (43113)");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain("Publish Agent");
    expect(markup).not.toContain("Actor JavaScript Code");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders an On-Chain Agent Card with Fuji registry details", () => {
    const markup = renderToStaticMarkup(
      <AgentIdentityCard
        name="VN Market & Macro Analyst Agent"
        slug="vn-market-analyst-agent"
        summary="Synthesizes sourced Vietnamese gold and news datasets."
        erc8004Registry="0x8004A818BFB912233c491871b3d84c89A494BD9e"
        erc8004TokenId="42"
        taskKind="vn-market-analysis"
        pricingModel="PAY_PER_RUN"
        priceAtomic="1000"
        payTo="0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf"
        registryVerified={true}
        registryTxHash={`0x${"c".repeat(64)}`}
        inputFields={["question", "goldQuotes", "articles"]}
      />,
    );

    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("AVALANCHE FUJI (43113)");
    expect(markup).toContain("#42");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("Verified on Fuji");
    expect(markup).toContain("0.001 fUSD / run");
    expect(markup).toContain("question");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("auto-generates Input-Schema Form fields including enum, integer, and array JSON fields", () => {
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
          items: { type: "array", default: [{ code: "SJC" }] },
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
    expect(markup).toContain('id="field-items"');
    expect(markup).toContain("<textarea");
    expect(markup).toContain("Pay 0.001 fUSD via x402 &amp; Run");
  });
});
