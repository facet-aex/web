import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActorStudio } from "@/components/actor-studio";
import { AgentIdentityCard } from "@/components/agent-identity-card";
import { AgentStudio } from "@/components/agent-studio";
import { FacetPlayground } from "@/components/facet-playground";
import { FacetPricingFields } from "@/components/facet-pricing-fields";
import { StudioFacetPreviewCard } from "@/components/studio-facet-preview-card";
import { computeStudioProgress } from "@/components/studio-stage-bar";
import {
  ACTOR_TEMPLATE_PRESETS,
  type ActorTemplatePreset,
} from "@/lib/actor-templates";
import {
  FACET_CATEGORIES_BY_TYPE,
  atomicToFusdInput,
  parseFusdToAtomic,
} from "@/lib/facet-ui";
import { isValidFacetName } from "@/lib/identifiers";
import { isFlatEditableSchema } from "@/lib/input-schema-builder";
import type { PublicFacet } from "@/lib/public-catalog";
import { checkFacetIdentityConflict } from "@/lib/use-owned-facets";

describe("ActorStudio, AgentStudio, and FacetPlayground", () => {
  it("renders Actor Studio starting truly blank with Actor-only categories, sequential stage bar, and Facet Preview", () => {
    const markup = renderToStaticMarkup(<ActorStudio />);

    expect(markup).toContain("Actor Studio");
    expect(markup).not.toContain("Hosted Actor Studio");
    expect(markup).toContain("Blank Actor");
    expect(markup).toContain("HTML Structured Extractor");
    expect(markup).toContain("PII &amp; Secret Redactor");
    expect(markup).not.toContain("VN Gold &amp; FX Scraper");
    expect(markup).not.toContain("VN Tech &amp; Macro News Extractor");
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
    expect(markup).toContain("AVALANCHE FUJI (43113)");
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

  it("renders FacetPricingFields with Pay per run active and Result/Event Coming Soon", () => {
    const markup = renderToStaticMarkup(
      <FacetPricingFields
        idPrefix="actor"
        pricingModel="PAY_PER_RUN"
        priceFusdText="0.005"
      />,
    );

    expect(markup).toContain("Pay per run");
    expect(markup).toContain("Pay per result");
    expect(markup).toContain("Pay per event");
    expect(markup).toContain("COMING SOON");
    expect(markup).toContain('value="0.005"');
    expect(markup).toContain("5,000 atomic fUSD");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
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

  it("provides two distinct-category runnable Actor templates that satisfy schema, payload size, and runtime contracts", async () => {
    expect(ACTOR_TEMPLATE_PRESETS).toHaveLength(2);
    expect(ACTOR_TEMPLATE_PRESETS.map((preset) => preset.id)).not.toContain(
      "vn-gold-fx-actor",
    );
    expect(ACTOR_TEMPLATE_PRESETS.map((preset) => preset.id)).not.toContain(
      "vn-tech-news-actor",
    );

    const allowedCategories = new Set(
      FACET_CATEGORIES_BY_TYPE.ACTOR.map((option) => option.slug),
    );
    const categories = ACTOR_TEMPLATE_PRESETS.map((preset) => preset.category);
    expect(new Set(categories).size).toBe(2);
    expect(categories).toEqual(["web-scraping", "data-processing"]);
    for (const category of categories) {
      expect(allowedCategories.has(category)).toBe(true);
    }

    const extractDefaultInput = (
      preset: ActorTemplatePreset,
    ): Record<string, unknown> => {
      const properties = preset.inputSchema.properties as Record<
        string,
        { default?: unknown }
      >;
      const required = Array.isArray(preset.inputSchema.required)
        ? (preset.inputSchema.required as string[])
        : [];
      for (const reqKey of required) {
        expect(properties[reqKey]?.default).toBeDefined();
      }
      const input: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        if (prop.default !== undefined) {
          input[key] = prop.default;
        }
      }
      return input;
    };

    for (const preset of ACTOR_TEMPLATE_PRESETS) {
      expect(isValidFacetName(preset.facetName)).toBe(true);
      expect(isFlatEditableSchema(preset.inputSchema).editable).toBe(true);
      expect(preset.code).toMatch(
        /export\s+default\s+(?:async\s+)?function(?:\s+run)?\s*\(/u,
      );

      const defaultInput = extractDefaultInput(preset);
      const previewBytes = Buffer.byteLength(
        JSON.stringify({
          code: preset.code,
          inputSchema: preset.inputSchema,
          input: defaultInput,
        }),
        "utf8",
      );
      expect(previewBytes).toBeLessThanOrEqual(16_384);

      const copyCorpus = [
        preset.label,
        preset.facetDisplayName,
        preset.summary,
        preset.description,
        preset.tags.join(" "),
        preset.code,
      ].join("\n");
      expect(copyCorpus).not.toMatch(/apify|rapidapi|erc-?8004|\bfuji\b/iu);
    }

    const htmlPreset = ACTOR_TEMPLATE_PRESETS.find(
      (preset) => preset.id === "html-structured-extractor",
    );
    expect(htmlPreset).toBeDefined();
    expect(htmlPreset!.code).toContain('import * as cheerio from "cheerio";');
    const strippedBody = htmlPreset!.code
      .replace(/^import\s+\*\s+as\s+cheerio\s+from\s+"cheerio";\s*/u, "")
      .replace(
        /export\s+default\s+async\s+function\s+run\s*\(/u,
        "return async function run(",
      );
    const compileFactory = new Function("cheerio", strippedBody) as (
      cheerioArg: Record<string, unknown>,
    ) => (input: Record<string, unknown>) => Promise<unknown>;
    const compiledRun = compileFactory({});
    await expect(compiledRun({ html: "   " })).rejects.toThrow(
      "Input 'html' must be a non-empty HTML string.",
    );

    const redactorPreset = ACTOR_TEMPLATE_PRESETS.find(
      (preset) => preset.id === "pii-secret-redactor",
    );
    expect(redactorPreset).toBeDefined();
    const dataUrl = `data:text/javascript;base64,${Buffer.from(
      redactorPreset!.code,
      "utf8",
    ).toString("base64")}`;
    const redactorMod = (await import(/* @vite-ignore */ dataUrl)) as {
      default: (
        input: Record<string, unknown>,
      ) => Promise<Array<Record<string, unknown>>>;
    };

    const defaultRedactorInput = extractDefaultInput(redactorPreset!);
    const maskedRows = await redactorMod.default(defaultRedactorInput);
    expect(maskedRows).toHaveLength(2);
    expect(maskedRows[0]).toMatchObject({
      id: "ticket-101",
      hasPii: true,
      findingCount: 3,
      riskLevel: "MEDIUM",
    });
    expect(maskedRows[0]?.sanitizedText).toBe(
      "Contact [EMAIL] or [PHONE] from [IPV4] regarding invoice.",
    );
    expect(maskedRows[1]).toMatchObject({
      id: "log-204",
      hasPii: true,
      findingCount: 2,
      riskLevel: "HIGH",
    });
    expect(maskedRows[1]?.sanitizedText).toBe(
      "Leaked token Bearer [JWT] and key [API_KEY].",
    );

    const pseudoRows = await redactorMod.default({
      mode: "pseudonymize",
      salt: "unit-test-salt",
      records: [
        { id: "r1", text: "Email bob@example.org once." },
        { id: "r2", text: "Email bob@example.org twice." },
      ],
    });
    expect(pseudoRows[0]?.sanitizedText).toMatch(
      /^Email \[EMAIL:[0-9a-f]{8}\] once\.$/u,
    );
    expect(pseudoRows[0]?.sanitizedText).not.toContain("bob@example.org");
    expect(pseudoRows[1]?.sanitizedText).toBe(
      String(pseudoRows[0]?.sanitizedText).replace("once.", "twice."),
    );

    const auditInput = {
      mode: "audit",
      records: [{ id: "a1", text: "Ping security@acme.dev from 192.168.1.50" }],
    };
    const auditRows = await redactorMod.default(auditInput);
    expect(auditRows[0]).toMatchObject({
      id: "a1",
      sanitizedText: "Ping security@acme.dev from 192.168.1.50",
      hasPii: true,
      findingCount: 2,
      counts: { EMAIL: 1, IPV4: 1 },
    });

    const luhnAndKeyRows = await redactorMod.default({
      mode: "mask",
      redactPrivateKeys: true,
      records: [
        {
          id: "card-valid",
          text: "Card 4532-0151-1283-0366 and key 0x" + "a".repeat(64),
        },
        {
          id: "card-invalid",
          text: "Ref 4532-0151-1283-0367",
        },
        {
          id: "clean",
          text: "Nothing sensitive in this summary.",
        },
      ],
    });
    expect(luhnAndKeyRows[0]).toMatchObject({
      id: "card-valid",
      sanitizedText: "Card [CARD] and key [PRIVATE_KEY]",
      hasPii: true,
      findingCount: 2,
      riskLevel: "HIGH",
    });
    expect(luhnAndKeyRows[1]).toMatchObject({
      id: "card-invalid",
      sanitizedText: "Ref 4532-0151-1283-0367",
      hasPii: false,
      findingCount: 0,
      riskLevel: "NONE",
    });
    expect(luhnAndKeyRows[2]).toMatchObject({
      id: "clean",
      sanitizedText: "Nothing sensitive in this summary.",
      hasPii: false,
      findingCount: 0,
      riskLevel: "NONE",
    });
  });
});
