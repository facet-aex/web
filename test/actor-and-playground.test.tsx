import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActorStudio } from "@/components/actor-studio";
import { AgentIdentityCard } from "@/components/agent-identity-card";
import { AgentStudio } from "@/components/agent-studio";
import { FacetPlayground } from "@/components/facet-playground";
import { computeStudioProgress } from "@/components/studio-stage-bar";
import type { PublicFacet } from "@/lib/public-catalog";

describe("ActorStudio, AgentStudio, and FacetPlayground", () => {
  it("renders Actor Studio with top sequential stage bar, presets, and Docker sandbox specs", () => {
    const markup = renderToStaticMarkup(<ActorStudio />);

    expect(markup).toContain("Actor Studio");
    expect(markup).not.toContain("Hosted Actor Studio");
    expect(markup).toContain("Blank Actor");
    expect(markup).toContain("VN Gold &amp; FX Scraper");
    expect(markup).toContain("VN Tech &amp; Macro News Extractor");
    expect(markup).toContain("rapid-stage-bar studio-stage-bar");
    expect(markup).toContain("Source &amp; Metadata");
    expect(markup).toContain("Input Schema");
    expect(markup).toContain("Docker Preview");
    expect(markup).toContain("Pricing &amp; Payout");
    expect(markup).toContain('data-state="current"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('data-state="locked"');
    expect(markup).toContain("Continue to Input Schema →");
    expect(markup).not.toContain('id="actor-preview-input"');
    expect(markup).toContain("facet/node-actor-runner:1.0");
    expect(markup).toContain("--network=none");
    expect(markup).toContain("Publish Actor");
    expect(markup).toContain("Link payout wallet");
    expect(markup).toContain("Run Docker preview");
    expect(markup).toContain("actor-version");
    expect(markup).not.toContain("Pre-Anchored Registry Tx");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders Agent Studio with top sequential stage bar, live On-Chain Agent Card, and without unused custom code textarea", () => {
    const markup = renderToStaticMarkup(<AgentStudio />);

    expect(markup).toContain("Agent Studio");
    expect(markup).toContain("VN Market &amp; Macro Analyst");
    expect(markup).toContain("Custom Agent");
    expect(markup).toContain("rapid-stage-bar studio-stage-bar");
    expect(markup).toContain("On-Chain Identity");
    expect(markup).toContain("Profile &amp; Pricing");
    expect(markup).toContain("Task Input Schema");
    expect(markup).toContain("Review &amp; Publish");
    expect(markup).toContain('data-state="current"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('data-state="locked"');
    expect(markup).toContain("Continue to Profile &amp; Pricing →");
    expect(markup).not.toContain('id="agent-display-name"');
    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("AVALANCHE FUJI (43113)");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain("Publish Agent");
    expect(markup).not.toContain("Actor JavaScript Code");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("enforces sequential step locking and re-locking when prior steps change", () => {
    const initial = computeStudioProgress({
      activeStep: 1,
      completedUpTo: 0,
      stepValidities: [true, true, false],
    });
    expect(initial.clampedActiveStep).toBe(1);
    expect(initial.getState(1)).toBe("current");
    expect(initial.getState(2)).toBe("locked");
    expect(initial.getState(3)).toBe("locked");
    expect(initial.getState(4)).toBe("locked");

    const step2Unlocked = computeStudioProgress({
      activeStep: 2,
      completedUpTo: 1,
      stepValidities: [true, true, false],
    });
    expect(step2Unlocked.clampedActiveStep).toBe(2);
    expect(step2Unlocked.getState(1)).toBe("done");
    expect(step2Unlocked.getState(2)).toBe("current");
    expect(step2Unlocked.getState(3)).toBe("locked");
    expect(step2Unlocked.getState(4)).toBe("locked");

    const backToStep1 = computeStudioProgress({
      activeStep: 1,
      completedUpTo: 1,
      stepValidities: [true, true, false],
    });
    expect(backToStep1.clampedActiveStep).toBe(1);
    expect(backToStep1.getState(1)).toBe("current");
    expect(backToStep1.getState(2)).toBe("available");
    expect(backToStep1.getState(3)).toBe("locked");
    expect(backToStep1.getState(4)).toBe("locked");

    const step4Unlocked = computeStudioProgress({
      activeStep: 4,
      completedUpTo: 3,
      stepValidities: [true, true, true],
    });
    expect(step4Unlocked.clampedActiveStep).toBe(4);
    expect(step4Unlocked.getState(1)).toBe("done");
    expect(step4Unlocked.getState(2)).toBe("done");
    expect(step4Unlocked.getState(3)).toBe("done");
    expect(step4Unlocked.getState(4)).toBe("current");

    const step3InvalidatedFromStep1 = computeStudioProgress({
      activeStep: 1,
      completedUpTo: 3,
      stepValidities: [true, true, false],
    });
    expect(step3InvalidatedFromStep1.clampedActiveStep).toBe(1);
    expect(step3InvalidatedFromStep1.getState(1)).toBe("current");
    expect(step3InvalidatedFromStep1.getState(2)).toBe("done");
    expect(step3InvalidatedFromStep1.getState(3)).toBe("available");
    expect(step3InvalidatedFromStep1.getState(4)).toBe("locked");

    const step1Invalidated = computeStudioProgress({
      activeStep: 3,
      completedUpTo: 2,
      stepValidities: [false, true, false],
    });
    expect(step1Invalidated.clampedActiveStep).toBe(1);
    expect(step1Invalidated.getState(1)).toBe("current");
    expect(step1Invalidated.getState(2)).toBe("locked");
    expect(step1Invalidated.getState(3)).toBe("locked");
    expect(step1Invalidated.getState(4)).toBe("locked");
  });

  it("renders an On-Chain Agent Card with Fuji registry details", () => {
    const markup = renderToStaticMarkup(
      <AgentIdentityCard
        provider="vn-data-labs"
        facetDisplayName="VN Market & Macro Analyst Agent"
        facetName="vn-market-analyst-agent"
        version="1.0.0"
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
      provider: "vn-data-labs",
      facetName: "vn-gold-fx-actor",
      facetDisplayName: "VN Gold & FX Scraper",
      description: "Vietnamese gold prices",
      category: "vietnamese-data",
      tags: ["vietnam", "gold"],
      facetType: "ACTOR",
      version: "1.0.0",
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
