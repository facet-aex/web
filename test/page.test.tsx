import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocsPage from "@/app/docs/page";
import FacetDetailPage from "@/app/facets/[provider]/[facetName]/page";
import HomePage from "@/app/page";
import StorePage from "@/app/store/page";
import ActorStudioPage from "@/app/studio/actor/page";
import AgentStudioPage from "@/app/studio/agent/page";
import ApiStudioPage from "@/app/studio/api/page";
import StudioHubPage from "@/app/studio/page";
import { CommerceEngineShowcase } from "@/components/commerce-engine-showcase";
import {
  LandingQuickstart,
  copyAgentSetupPrompt,
  getAgentSetupPrompt,
} from "@/components/landing-quickstart";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HomePage landing page", () => {
  it("renders Hero without trailing period, redesigned production commerce flow, 1-line section titles, and 2-choice quickstart", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const mainAndHeader = markup.split("<footer")[0] ?? markup;

    // Page 1: Hero preserved without trailing period in title
    expect(markup).toContain("Federated Agent Capability Exchange &amp; Trust");
    expect(markup).toContain("hero-eyebrow");
    expect(markup).toContain("hero-canvas");
    expect(markup).toContain("hero-enter");
    expect(markup).toContain("scroll-reveal");
    expect(markup).toContain("Give agents");
    expect(markup).toContain("the tools to act");
    expect(markup).not.toContain("the tools to act.");
    expect(markup).toContain("Call Private APIs");
    expect(markup).toContain("Run Live Scrapers");
    expect(markup).toContain("Hire Peer Agents");
    expect(markup).toContain("Pay Only Per Call");
    expect(markup).not.toContain("Discover and run");
    expect(markup).not.toContain("hero-terminal");
    expect(markup).not.toContain(
      "Federated Agent Capability Exchange &amp; Trust —",
    );

    // Ensure no heading (h1-h3) or span on Home ends with a trailing period
    expect(markup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);

    // Avalanche branding invariant on Home header/main (footer is updated in S2.3)
    expect(mainAndHeader).not.toMatch(/\bfuji\b/iu);

    // Page 2: Minimal 1-menu production commerce showcase (replaces static bento-grid & duplicate menus)
    expect(markup).not.toContain("bento-grid");
    expect(markup).not.toContain("Built for Verifiable Commerce");
    expect(markup).not.toContain("commerce-pipeline-bar");
    expect(markup).not.toContain("commerce-pillars-strip");
    expect(markup).toContain("commerce-engine");
    expect(markup).toContain("Autonomous Execution Under Strict Control");
    expect(markup).not.toContain("Autonomous Execution Under Strict Control.");
    expect(markup).toContain("Unified Discovery");
    expect(markup).toContain("Default-Deny Spend Policy");
    expect(markup).not.toContain("Scoped Spending Grants");
    expect(markup).not.toContain("grant tokens");
    expect(markup).not.toContain("Scoped Grant Billing");
    expect(markup).toContain("Zero-Trust Execution");
    expect(markup).toContain("Atomic x402 Settlement");
    expect(markup).toContain("Cryptographic Receipts");

    // Page 3: Unified Facet taxonomy in production framing
    expect(markup).toContain("facet-taxonomy-bar");
    expect(markup).toContain("API, Actor &amp; Agent — All Are Facets");
    expect(markup).not.toContain("API, Actor &amp; Agent — All Are Facets.");
    expect(markup).toContain("Default-Deny Spend Policy");
    expect(markup).toContain("ERC-8004");

    // Page 4: Collapsed 2-choice Quickstart (Prompt vs Manual)
    expect(markup).toContain("landing-showcase");
    expect(markup).toContain("Connect Any Agent in Seconds");
    expect(markup).not.toContain("Connect Any Agent in Seconds.");
    expect(markup).toContain("Prompt");
    expect(markup).toContain("Manual");
    expect(markup).not.toContain("Copy Setup Prompt");
    expect(markup).not.toContain("npm install -g @facet-aex/cli");
    expect(markup).not.toContain("facet wallet create");
    expect(markup).not.toContain("facet mcp install");
    expect(markup).not.toContain("TypeScript SDK");
    expect(markup).not.toContain("facet grant create");
    expect(markup).not.toContain("FACET_GRANT_TOKEN");
    expect(markup).not.toContain("@facet/agent-sdk");
    expect(markup).not.toContain("@facet/mcp-server");
    expect(markup).not.toContain("publish-actor");

    // Production vision copy & strict FACET branding checks
    expect(markup).not.toContain("127.0.0.1");
    expect(markup).not.toContain("--network=none");
    expect(markup).not.toMatch(/apify|rapidapi/iu);
    expect(markup).not.toContain("External HTTP API");
    expect(markup).not.toContain("Hosted Actor");
    expect(markup).not.toContain("Autonomous Agent");
    expect(markup).toContain('src="/facet-logo.svg"');
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain('href="/docs"');
    expect(markup).toContain('href="/studio/api"');
    expect(markup).toContain('href="/studio/actor"');
    expect(markup).toContain('href="/studio/agent"');
    expect(markup).not.toContain('id="provider-console"');
    expect(markup).not.toContain('id="facet-search"');
  });
});

describe("LandingQuickstart 2-choice workflow", () => {
  it("default state renders only Prompt and Manual choices without expanded steps", () => {
    const markup = renderToStaticMarkup(<LandingQuickstart />);

    expect(markup).toContain("Prompt");
    expect(markup).toContain("Manual");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="quickstart-panel-prompt"');
    expect(markup).toContain('aria-controls="quickstart-panel-manual"');
    expect(markup).not.toContain('id="quickstart-panel-prompt"');
    expect(markup).not.toContain('id="quickstart-panel-manual"');
    expect(markup).not.toContain("npm install");
    expect(markup).not.toContain("Copy Setup Prompt");
    expect(markup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("Prompt choice renders only caption and Copy Setup Prompt button without exposing prompt text in DOM", () => {
    const markup = renderToStaticMarkup(
      <LandingQuickstart initialSelection="prompt" />,
    );

    expect(markup).toContain('id="quickstart-panel-prompt"');
    expect(markup).toContain("Copy Setup Prompt");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).not.toContain('id="quickstart-panel-manual"');
    expect(markup).not.toContain("npm install -g @facet-aex/cli");
    expect(markup).not.toContain("facet wallet create");
    expect(markup).not.toContain("facet mcp install");
    expect(markup).not.toContain("search_facets");
    expect(markup).not.toContain("facet policy grant");
    expect(markup).not.toContain(getAgentSetupPrompt());
    expect(markup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("Manual choice renders strictly 3 steps (CLI, Wallet + Faucet, MCP) without SDK or Publish", () => {
    const markup = renderToStaticMarkup(
      <LandingQuickstart initialSelection="manual" />,
    );

    expect(markup).toContain('id="quickstart-panel-manual"');
    expect(markup).not.toContain('id="quickstart-panel-prompt"');
    expect(markup).toContain("@facet-aex/cli");
    expect(markup).toContain("facet --help");
    expect(markup).toContain("facet wallet create");
    expect(markup).toContain("facet wallet status");
    expect(markup).toContain('href="/faucet"');
    expect(markup).toContain("facet mcp install antigravity");
    expect(markup).toContain("facet mcp install codex");
    expect(markup).toContain("facet mcp install claude");
    expect(markup).toContain("facet mcp config antigravity");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/docs#agent-guide"');

    expect(markup).not.toContain("@facet/agent-sdk");
    expect(markup).not.toContain("@facet/mcp-server");
    expect(markup).not.toContain("TypeScript SDK");
    expect(markup).not.toContain("FacetClient");
    expect(markup).not.toContain("facet grant create");
    expect(markup).not.toContain("FACET_GRANT_TOKEN");
    expect(markup).not.toContain("publish-actor");
    expect(markup).not.toMatch(/\bfuji\b/iu);
    expect(markup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);
  });

  it("copyAgentSetupPrompt copies real setup instructions and handles unavailable clipboard", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(
      async () => undefined,
    );
    const copied = await copyAgentSetupPrompt({ writeText });

    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    const promptText = writeText.mock.calls[0]?.[0];
    expect(typeof promptText).toBe("string");
    expect(promptText).toBe(getAgentSetupPrompt());

    expect(promptText).toContain("Node");
    expect(promptText).toContain("22");
    expect(promptText).toContain("npm install -g @facet-aex/cli");
    expect(promptText).toContain("facet wallet create");
    expect(promptText).toContain("facet wallet status");
    expect(promptText).toContain("https://facet.briandev.space/faucet");
    expect(promptText).toContain("facet mcp install antigravity");
    expect(promptText).toContain("facet mcp install codex");
    expect(promptText).toContain("facet mcp install claude");
    expect(promptText).toContain("facet mcp config antigravity");
    expect(promptText).toContain("facet search");
    expect(promptText).toContain("facet inspect <provider>/<facet-name>");
    expect(promptText).toContain(
      "facet policy grant --facet <provider>/<facet-name> --version <semver> --max-per-run <atomic> --daily-cap <atomic>",
    );
    expect(promptText).toContain("search_facets");

    expect(promptText).not.toMatch(/\bfuji\b/iu);
    expect(promptText).not.toMatch(
      /facet grant create|FACET_GRANT_TOKEN|@facet\/agent-sdk|@facet\/mcp-server|127\.0\.0\.1|publish-actor/iu,
    );

    expect(await copyAgentSetupPrompt(null)).toBe(false);
    expect(
      await copyAgentSetupPrompt({
        writeText: vi.fn(async () => {
          throw new Error("Clipboard permission denied");
        }),
      }),
    ).toBe(false);

    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyAgentSetupPrompt()).toBe(true);

    vi.stubGlobal("navigator", {});
    expect(await copyAgentSetupPrompt()).toBe(false);
  });
});

describe("CommerceEngineShowcase stages", () => {
  it("aligns stages 02-05 with Default-Deny Spend Policy, TaskEscrow, ERC-8004, and Avalanche branding", () => {
    const stage02 = renderToStaticMarkup(
      <CommerceEngineShowcase initialStageId="authorize" />,
    );
    expect(stage02).toContain("Default-Deny Spend Policy");
    expect(stage02).toContain("Keychain");
    expect(stage02).not.toContain("grant tokens");
    expect(stage02).not.toContain("Scoped Spending Grants");

    const stage03 = renderToStaticMarkup(
      <CommerceEngineShowcase initialStageId="execute" />,
    );
    expect(stage03).toContain("Zero-Trust Execution");
    expect(stage03).toContain("HTTP");

    const stage04 = renderToStaticMarkup(
      <CommerceEngineShowcase initialStageId="settle" />,
    );
    expect(stage04).toContain("PAY_PER_RUN");
    expect(stage04).toContain("95%");
    expect(stage04).toContain("5%");
    expect(stage04).toContain("PAY_PER_RESULT");
    expect(stage04).toContain("TaskEscrow");
    expect(stage04).toContain("Avalanche");

    const stage05 = renderToStaticMarkup(
      <CommerceEngineShowcase initialStageId="verify" />,
    );
    expect(stage05).toContain("FacetReceiptLog");
    expect(stage05).toContain("ERC-8004");
    expect(stage05).toContain("Avalanche");

    for (const stageMarkup of [stage02, stage03, stage04, stage05]) {
      expect(stageMarkup).not.toMatch(/\bfuji\b/iu);
      expect(stageMarkup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);
    }
  });
});

describe("StorePage catalog", () => {
  it("renders ONLY the 3 Facet types plus All as modality tabs and switches category sub-filters per FacetType", async () => {
    const allMarkup = renderToStaticMarkup(
      await StorePage({ searchParams: Promise.resolve({}) }),
    );

    expect(allMarkup).toContain("Facet Store");
    expect(allMarkup).toContain("What is a Facet?");
    expect(allMarkup).toContain('action="/store"');
    expect(allMarkup).toContain('id="facet-search"');
    expect(allMarkup).toContain("All Facets");
    expect(allMarkup).toContain(">API<");
    expect(allMarkup).toContain(">Actor<");
    expect(allMarkup).toContain(">Agent<");
    expect(allMarkup).not.toContain("HTTP APIs");
    expect(allMarkup).not.toContain("Hosted Actors");
    expect(allMarkup).not.toContain("A2A Agents");
    expect(allMarkup).not.toContain("<span>VN</span>");
    expect(allMarkup).toContain("store-category-bar");
    expect(allMarkup).toContain('href="/store?category=others"');

    const apiMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "API" }),
      }),
    );
    expect(apiMarkup).toContain('href="/store?type=API&amp;category=data"');
    expect(apiMarkup).toContain('href="/store?type=API&amp;category=social"');
    expect(apiMarkup).toContain('href="/store?type=API&amp;category=others"');
    expect(apiMarkup).not.toContain("vietnamese-data");

    const actorMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "ACTOR" }),
      }),
    );
    expect(actorMarkup).toContain(
      'href="/store?type=ACTOR&amp;category=web-scraping"',
    );
    expect(actorMarkup).toContain(
      'href="/store?type=ACTOR&amp;category=vietnamese-data"',
    );
    expect(actorMarkup).toContain(
      'href="/store?type=ACTOR&amp;category=others"',
    );

    const agentMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "AGENT" }),
      }),
    );
    expect(agentMarkup).toContain(
      'href="/store?type=AGENT&amp;category=market-analysis"',
    );
    expect(agentMarkup).toContain(
      'href="/store?type=AGENT&amp;category=research"',
    );
    expect(agentMarkup).toContain(
      'href="/store?type=AGENT&amp;category=others"',
    );
  });
});

describe("Studio pages", () => {
  it("renders Studio overview and API, Actor, and Coming Soon Agent studios without sub-navbar or overview back links", () => {
    const hub = renderToStaticMarkup(<StudioHubPage />);
    const api = renderToStaticMarkup(<ApiStudioPage />);
    const actor = renderToStaticMarkup(<ActorStudioPage />);
    const agent = renderToStaticMarkup(<AgentStudioPage />);

    expect(hub).toContain("Publish a Facet");
    expect(hub).toContain("facet-taxonomy-bar");
    expect(api).toContain("API Studio");
    expect(actor).toContain("Actor Studio");
    expect(agent).toContain("Agent Studio");
    expect(agent).toMatch(/coming soon/i);
    expect(agent).not.toContain('id="agent-display-name"');

    expect(api).not.toContain("HTTP API Studio");
    expect(actor).not.toContain("Hosted Actor Studio");
    expect(agent).not.toContain("ERC-8004 Agent Studio");

    for (const markup of [hub, api, actor, agent]) {
      expect(markup).not.toContain("studio-subnav-wrap");
      expect(markup).not.toContain("studio-breadcrumb");
      expect(markup).not.toContain("← Studio Overview");
      expect(markup).not.toContain("Active Provider");
      expect(markup).not.toContain("+ New Provider");
      expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
    }
  });
});

describe("DocsPage documentation", () => {
  it("renders structured sections, Agent Integration guide, and verified Fuji contracts without Apify, RapidAPI, or ERC-8004 labels", () => {
    const markup = renderToStaticMarkup(<DocsPage />);

    expect(markup).toContain("FACET Documentation");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
    expect(markup).toContain("Integrating FACET into Your AI Agent");
    expect(markup).toContain("search_facets");
    expect(markup).toContain("get_facet");
    expect(markup).toContain("invoke_facet");
    expect(markup).toContain("FacetClient");
    expect(markup).toContain("PAYMENT-REQUIRED");
    expect(markup).toContain("PAYMENT-SIGNATURE");
    expect(markup).toContain("0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f");
    expect(markup).toContain("0xc37c12bcd53a4ba5fd33870cecc74a4ba601e3a2");
    expect(markup).toContain("0xc50cb5d5ff6c71eb1b065971c198a9edb0ecff06");
    expect(markup).toContain("0x5dc611b5642c306dd50fa7f786194dc04bd12fa7");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
  });
});

describe("FacetDetailPage modality views", () => {
  it("renders On-Chain Agent Card and breadcrumb for AGENT", async () => {
    const provider = "vn-data-studio";
    const facetName = "vn-market-analyst-agent";
    vi.stubEnv("FACET_CONTROL_API_URL", "http://127.0.0.1:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          facet: {
            provider,
            facetName,
            facetDisplayName: "VN Market Analyst",
            description: "Synthesizes sourced datasets.",
            category: "a2a-agents",
            tags: ["a2a"],
            facetType: "AGENT",
            version: "1.0.0",
            method: "POST",
            inputSchema: {
              type: "object",
              properties: { question: { type: "string" } },
            },
            outputSchema: { type: "object" },
            pricing: {
              model: "PAY_PER_RUN",
              priceAtomic: "1000",
              assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
              chainId: 43113,
              payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
            },
            agentMeta: {
              erc8004ChainId: 43113,
              erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
              erc8004TokenId: "7",
              taskKind: "vn-market-analysis",
              registryVerified: true,
            },
            publishedAt: "2026-11-16T00:00:00.000Z",
          },
        }),
      ),
    );

    const markup = renderToStaticMarkup(
      await FacetDetailPage({
        params: Promise.resolve({ provider, facetName }),
      }),
    );

    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("Facet · Agent");
    expect(markup).toContain("#7");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/store?type=AGENT"');
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });
});
