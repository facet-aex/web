import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActorStudio } from "@/components/actor-studio";
import { AgentIdentityCard } from "@/components/agent-identity-card";
import { AgentStudio } from "@/components/agent-studio";
import { FacetDetailView } from "@/components/facet-detail-view";
import { FacetPlayground } from "@/components/facet-playground";
import { FacetPricingFields } from "@/components/facet-pricing-fields";
import { StudioFacetPreviewCard } from "@/components/studio-facet-preview-card";
import { computeStudioProgress } from "@/components/studio-stage-bar";
import { atomicToFusdInput, parseFusdToAtomic } from "@/lib/facet-ui";
import type { PublicFacet } from "@/lib/public-catalog";
import { checkFacetIdentityConflict } from "@/lib/use-owned-facets";

describe("ActorStudio, AgentStudio, FacetDetailView, and FacetPlayground", () => {
  it("renders Actor Studio starting truly blank with Actor-only categories, sequential stage bar, and Facet Preview without Fuji", () => {
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
    expect(markup).toMatch(/<input[^>]*id="actor-name"[^>]*value=""/u);
    expect(markup).toMatch(/<input[^>]*id="actor-slug"[^>]*value=""/u);
    expect(markup).toContain("Select a category…");
    expect(markup).toContain("Untitled Facet");
    expect(markup).toContain("No fields defined");
    expect(markup).toContain('<select id="actor-category"');
    expect(markup).toContain("Web Scraping");
    expect(markup).toContain("Vietnamese Data");
    expect(markup).toContain("Data Processing");
    expect(markup).toContain("E-commerce");
    expect(markup).toContain("Social &amp; News");
    expect(markup).toContain("Others");
    expect(markup).not.toContain("Developer Tools");
    expect(markup).not.toContain("DeFi &amp; Trading");
    expect(markup).not.toContain("actor-category-presets");
    expect(markup).toContain('data-state="current"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('data-state="locked"');
    expect(markup).toContain("Continue to Input Schema →");
    expect(markup).not.toContain('id="actor-preview-input"');
    expect(markup).toContain("Facet Preview");
    expect(markup).not.toContain("Publish Readiness");
    expect(markup).toContain("facet/node-actor-runner:1.0");
    expect(markup).toContain("--network=none");
    expect(markup).toContain("actor-version");
    expect(markup).not.toContain("Pre-Anchored Registry Tx");
    expect(markup).not.toMatch(/\bfuji\b/iu);
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders Agent Studio with Agent-only categories, sequential stage bar, live On-Chain Agent Card, and without Publish Readiness", () => {
    const markup = renderToStaticMarkup(<AgentStudio />);

    expect(markup).toContain("Agent Studio");
    expect(markup).toContain("VN Market &amp; Macro Analyst");
    expect(markup).toContain("Custom Agent");
    expect(markup).toContain("rapid-stage-bar studio-stage-bar");
    expect(markup).toContain("Identity &amp; Profile");
    expect(markup).toContain("Task Input Schema");
    expect(markup).toContain("Contract Preview");
    expect(markup).toContain("Pricing &amp; Payout");
    expect(markup).toContain('id="agent-display-name"');
    expect(markup).toContain('<select id="agent-category"');
    expect(markup).toContain("Multi-Task");
    expect(markup).toContain("Market Analysis");
    expect(markup).toContain("Research");
    expect(markup).toContain("DeFi &amp; Trading");
    expect(markup).toContain("Workflow Automation");
    expect(markup).toContain("Others");
    expect(markup).not.toContain("Web Scraping");
    expect(markup).not.toContain("Developer Tools");
    expect(markup).not.toContain("agent-category-presets");
    expect(markup).toContain('data-state="current"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('data-state="locked"');
    expect(markup).toContain("Continue to Task Input Schema →");
    expect(markup).not.toContain('id="agent-payto"');
    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("AVALANCHE (43113)");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).not.toContain("Publish Readiness");
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

  it("renders an On-Chain Agent Card with Avalanche registry details and zero Fuji wording", () => {
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
    expect(markup).toContain("AVALANCHE (43113)");
    expect(markup).toContain("#42");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("Verified on Avalanche");
    expect(markup).toContain("0.001 fUSD / run");
    expect(markup).toContain("question");
    expect(markup).not.toMatch(/\bfuji\b/iu);
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders FacetPlayground disconnected Connect Wallet CTA, Payment Method selector, /faucet link, and schema fields across ACTOR, API, and AGENT", () => {
    const dualActorFacet: PublicFacet = {
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
        maxAmountAtomic: "1000",
        assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
        chainId: 43113,
        payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        isPrimary: true,
      },
      pricingOptions: [
        {
          model: "PAY_PER_RUN",
          priceAtomic: "1000",
          maxAmountAtomic: "1000",
          assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
          chainId: 43113,
          payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
          isPrimary: true,
        },
        {
          model: "PAY_PER_RESULT",
          priceAtomic: "500",
          maxItemsCap: 10,
          maxAmountAtomic: "5000",
          assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
          chainId: 43113,
          payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
          isPrimary: false,
        },
      ],
      publishedAt: "2026-11-16T00:00:00.000Z",
    };

    const actorMarkup = renderToStaticMarkup(
      <FacetPlayground facet={dualActorFacet} />,
    );
    expect(actorMarkup).toContain("Input-Schema Form");
    expect(actorMarkup).toContain('id="field-brand"');
    expect(actorMarkup).toContain('id="field-limit"');
    expect(actorMarkup).toContain('id="field-items"');
    expect(actorMarkup).toContain("<textarea");
    expect(actorMarkup).toContain("Connect Wallet");
    expect(actorMarkup).toContain('href="/faucet"');
    expect(actorMarkup).toContain("playground-pricing-selector");
    expect(actorMarkup).toContain("PAY_PER_RUN");
    expect(actorMarkup).toContain("PAY_PER_RESULT");
    expect(actorMarkup).toContain("0.005 fUSD");
    expect(actorMarkup).not.toMatch(/\bfuji\b/iu);
    expect(actorMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);

    const apiFacet: PublicFacet = {
      ...dualActorFacet,
      facetType: "API",
      facetName: "github-search-api",
      facetDisplayName: "GitHub Search API",
      method: "GET",
      pricingOptions: [dualActorFacet.pricingOptions![1]!],
      pricing: dualActorFacet.pricingOptions![1]!,
      apiMeta: {
        method: "GET",
        pathTemplate: "/search/repositories",
        datasetPath: "items",
        registryTxHash: `0x${"d".repeat(64)}`,
        registryVerified: true,
      },
    };
    const apiMarkup = renderToStaticMarkup(
      <FacetPlayground facet={apiFacet} />,
    );
    expect(apiMarkup).toContain("Connect Wallet");
    expect(apiMarkup).toContain('href="/faucet"');
    expect(apiMarkup).not.toContain("playground-pricing-selector");
    expect(apiMarkup).not.toMatch(/\bfuji\b/iu);

    const agentFacet: PublicFacet = {
      ...dualActorFacet,
      facetType: "AGENT",
      facetName: "vn-market-analyst",
      facetDisplayName: "VN Market Analyst",
      agentMeta: {
        erc8004ChainId: 43113,
        erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        erc8004TokenId: "7",
        taskKind: "vn-market-analysis",
        registryVerified: true,
      },
    };
    const agentMarkup = renderToStaticMarkup(
      <FacetPlayground facet={agentFacet} />,
    );
    expect(agentMarkup).toContain("Connect Wallet");
    expect(agentMarkup).toContain('href="/faucet"');
    expect(agentMarkup).not.toMatch(/\bfuji\b/iu);
    expect(agentMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders FacetDetailView with all pricingOptions and verified apiMeta without Fuji or ERC-8004 prose", () => {
    const apiFacet: PublicFacet = {
      provider: "alice-labs",
      facetName: "github-search",
      facetDisplayName: "GitHub Search",
      description: "Searches public repositories.",
      category: "developer-tools",
      tags: ["github"],
      facetType: "API",
      version: "1.0.0",
      method: "GET",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string", default: "avalanche" } },
      },
      outputSchema: { type: "object" },
      pricing: {
        model: "PAY_PER_RUN",
        priceAtomic: "2000",
        maxAmountAtomic: "2000",
        assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
        chainId: 43113,
        payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        isPrimary: true,
      },
      pricingOptions: [
        {
          model: "PAY_PER_RUN",
          priceAtomic: "2000",
          maxAmountAtomic: "2000",
          assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
          chainId: 43113,
          payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
          isPrimary: true,
        },
        {
          model: "PAY_PER_RESULT",
          priceAtomic: "500",
          maxItemsCap: 10,
          maxAmountAtomic: "5000",
          assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
          chainId: 43113,
          payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
          isPrimary: false,
        },
      ],
      apiMeta: {
        method: "GET",
        pathTemplate: "/search/repositories",
        datasetPath: "items",
        registryTxHash: `0x${"e".repeat(64)}`,
        registryVerified: true,
      },
      publishedAt: "2026-11-20T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(<FacetDetailView facet={apiFacet} />);
    const mainMarkup =
      markup.split('<footer class="site-footer">')[0] ?? markup;

    expect(mainMarkup).toContain("x402 Pricing (Avalanche)");
    expect(mainMarkup).toContain("PAY_PER_RUN");
    expect(mainMarkup).toContain("0.002 fUSD");
    expect(mainMarkup).toContain("PAY_PER_RESULT");
    expect(mainMarkup).toContain("0.0005 fUSD");
    expect(mainMarkup).toContain("0.005 fUSD");
    expect(mainMarkup).toContain("GET");
    expect(mainMarkup).toContain("/search/repositories");
    expect(mainMarkup).toContain("items");
    expect(mainMarkup).toContain("Verified on Avalanche ✓");
    expect(mainMarkup).not.toMatch(/\bfuji\b/iu);
    expect(mainMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("detects duplicate (facetName, version) and cross-type conflicts immediately", () => {
    const owned = [
      {
        provider: "brian-gemini",
        facetName: "vn-gold-fx-actor",
        facetDisplayName: "VN Gold & FX Scraper",
        facetType: "ACTOR" as const,
        version: "1.0.0",
        status: "PUBLISHED",
      },
      {
        provider: "brian-gemini",
        facetName: "vn-gold-fx-actor",
        facetDisplayName: "VN Gold & FX Scraper",
        facetType: "ACTOR" as const,
        version: "1.0.2",
        status: "REGISTRATION_PENDING",
      },
    ];

    const exact = checkFacetIdentityConflict(owned, {
      facetName: "vn-gold-fx-actor",
      version: "1.0.0",
      facetType: "ACTOR",
    });
    expect(exact).toMatchObject({
      kind: "VERSION_CONFLICT",
      suggestedVersion: "1.0.3",
    });

    const crossType = checkFacetIdentityConflict(owned, {
      facetName: "vn-gold-fx-actor",
      version: "2.0.0",
      facetType: "AGENT",
    });
    expect(crossType).toMatchObject({
      kind: "TYPE_CONFLICT",
      suggestedVersion: null,
    });

    expect(
      checkFacetIdentityConflict(owned, {
        facetName: "vn-gold-fx-actor",
        version: "1.0.3",
        facetType: "ACTOR",
      }),
    ).toBeNull();

    expect(
      checkFacetIdentityConflict(owned, {
        facetName: "fresh-actor",
        version: "1.0.0",
        facetType: "ACTOR",
      }),
    ).toBeNull();
  });

  it("converts fUSD decimal price inputs to exact atomic strings and rejects invalid decimals", () => {
    expect(parseFusdToAtomic("0.001")).toBe("1000");
    expect(parseFusdToAtomic("1")).toBe("1000000");
    expect(parseFusdToAtomic("0.000001")).toBe("1");
    expect(parseFusdToAtomic("1.250000")).toBe("1250000");
    expect(parseFusdToAtomic("0")).toBeNull();
    expect(parseFusdToAtomic("0.0000001")).toBeNull();
    expect(parseFusdToAtomic("-1")).toBeNull();
    expect(parseFusdToAtomic("abc")).toBeNull();

    expect(atomicToFusdInput("1000")).toBe("0.001");
    expect(atomicToFusdInput("1000000")).toBe("1");
    expect(atomicToFusdInput("1250000")).toBe("1.25");
  });

  it("renders multi-select FacetPricingFields with both options, computed escrow deposit, primary selector, last-option lock, disabled hint, and legacy compat", () => {
    const dualMarkup = renderToStaticMarkup(
      <FacetPricingFields
        options={[
          { model: "PAY_PER_RUN", priceFusd: "0.001", isPrimary: true },
          {
            model: "PAY_PER_RESULT",
            priceFusd: "0.0005",
            maxItemsCap: 10,
            isPrimary: false,
          },
        ]}
        onChange={() => {}}
      />,
    );

    expect(dualMarkup).toContain("pricing-option-grid");
    expect(dualMarkup).toContain("pricing-option-card");
    expect(dualMarkup).toContain("Pay per run");
    expect(dualMarkup).toContain("Pay per result");
    expect(dualMarkup).toContain("0.005 fUSD");
    expect(dualMarkup).toContain("Primary");
    expect(dualMarkup).not.toContain("COMING SOON");
    expect(dualMarkup).not.toContain("Pay per event");
    expect(dualMarkup).not.toContain("demo payer");
    expect(dualMarkup).not.toMatch(/\bfuji\b/iu);
    expect(dualMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);

    const checkedMatches =
      dualMarkup.match(/type="checkbox"[^>]*checked/gu) ?? [];
    expect(checkedMatches).toHaveLength(2);

    const singleMarkup = renderToStaticMarkup(
      <FacetPricingFields
        options={[
          { model: "PAY_PER_RUN", priceFusd: "0.001", isPrimary: true },
        ]}
        onChange={() => {}}
      />,
    );
    expect(singleMarkup).toMatch(
      /<input(?=[^>]*type="checkbox")(?=[^>]*value="PAY_PER_RUN")(?=[^>]*disabled)[^>]*>/u,
    );

    const hintMarkup = renderToStaticMarkup(
      <FacetPricingFields
        options={[
          { model: "PAY_PER_RUN", priceFusd: "0.001", isPrimary: true },
        ]}
        onChange={() => {}}
        allowPayPerResult={false}
        payPerResultHint="Add a datasetPath to enable Pay per result."
      />,
    );
    expect(hintMarkup).toMatch(
      /<input(?=[^>]*type="checkbox")(?=[^>]*value="PAY_PER_RESULT")(?=[^>]*disabled)[^>]*>/u,
    );
    expect(hintMarkup).toContain("Add a datasetPath to enable Pay per result.");

    const legacyMarkup = renderToStaticMarkup(
      <FacetPricingFields
        idPrefix="legacy"
        pricingModel="PAY_PER_RUN"
        priceFusdText="0.005"
      />,
    );
    expect(legacyMarkup).toContain("Pay per run");
    expect(legacyMarkup).toContain('value="0.005"');
    expect(legacyMarkup).toContain("5,000 atomic fUSD");
    expect(legacyMarkup).not.toMatch(/\bfuji\b/iu);
  });

  it("renders StudioFacetPreviewCard with live metadata, category label, pricing, fields, and conflict state", () => {
    const markup = renderToStaticMarkup(
      <StudioFacetPreviewCard
        facetType="ACTOR"
        provider="brian-gemini"
        facetDisplayName="HTML Product Extractor"
        facetName="html-product-extractor"
        version="1.0.1"
        category="web-scraping"
        summary="Normalized ecommerce extractor."
        description="Fallback description"
        tags={["html", "pricing"]}
        pricingModel="PAY_PER_RUN"
        priceAtomic="5000"
        payoutWallet="0x688f45917D9BA23bd6F071d9992943518B94b0B4"
        inputFields={["html", "keyword"]}
        runtimeLabel="facet/node-actor-runner:1.0"
        codeLineCount={142}
        hasEntrypointExport={true}
        conflictMessage="Already exists"
      />,
    );

    expect(markup).toContain("Facet Preview");
    expect(markup).toContain("HTML Product Extractor");
    expect(markup).toContain("brian-gemini/html-product-extractor@1.0.1");
    expect(markup).toContain("Web Scraping");
    expect(markup).toContain("0.005 fUSD / run");
    expect(markup).toContain("html");
    expect(markup).toContain("Conflict");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });
});
