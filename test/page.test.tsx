import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import DocsPage from "@/app/docs/page";
import FacetDetailPage from "@/app/facets/[facetId]/page";
import HomePage from "@/app/page";
import StorePage from "@/app/store/page";
import ActorStudioPage from "@/app/studio/actor/page";
import AgentStudioPage from "@/app/studio/agent/page";
import ApiStudioPage from "@/app/studio/api/page";
import StudioHubPage from "@/app/studio/page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HomePage landing page", () => {
  it("renders Hero without trailing period, redesigned production commerce flow, 1-line section titles, and 2-path quickstart", () => {
    const markup = renderToStaticMarkup(<HomePage />);

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

    // Ensure no heading (h1-h3) on Home ends with a trailing period
    expect(markup).not.toMatch(/\.<\/(span|h1|h2|h3)>/u);

    // Page 2: Minimal 1-menu production commerce showcase (replaces static bento-grid & duplicate menus)
    expect(markup).not.toContain("bento-grid");
    expect(markup).not.toContain("Built for Verifiable Commerce");
    expect(markup).not.toContain("commerce-pipeline-bar");
    expect(markup).not.toContain("commerce-pillars-strip");
    expect(markup).toContain("commerce-engine");
    expect(markup).toContain("Autonomous Execution Under Strict Control");
    expect(markup).not.toContain("Autonomous Execution Under Strict Control.");
    expect(markup).toContain("Unified Discovery");
    expect(markup).toContain("Scoped Spending Grants");
    expect(markup).toContain("Zero-Trust Execution");
    expect(markup).toContain("Atomic x402 Settlement");
    expect(markup).toContain("Cryptographic Receipts");

    // Page 3: Unified Facet taxonomy in production framing
    expect(markup).toContain("facet-taxonomy-bar");
    expect(markup).toContain("API, Actor &amp; Agent — All Are Facets");
    expect(markup).not.toContain("API, Actor &amp; Agent — All Are Facets.");

    // Page 4: Fast 2-option Quickstart (Agent Prompt + Manual CLI/Grant/MCP/SDK)
    expect(markup).toContain("landing-showcase");
    expect(markup).toContain("Connect Any Agent in Seconds");
    expect(markup).not.toContain("Connect Any Agent in Seconds.");
    expect(markup).toContain("Paste Prompt to Your Agent");
    expect(markup).toContain("Install CLI, Grant, MCP &amp; SDK");
    expect(markup).toContain("facet grant create");
    expect(markup).toContain("@facet/agent-sdk");
    expect(markup).toContain("@facet/mcp-server");

    // Production vision copy & strict FACET branding checks
    expect(markup).not.toContain("127.0.0.1");
    expect(markup).not.toContain("--network=none");
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
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

    const apiMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "EXTERNAL_HTTP_API" }),
      }),
    );
    expect(apiMarkup).toContain(
      'href="/store?type=EXTERNAL_HTTP_API&amp;category=data"',
    );
    expect(apiMarkup).toContain(
      'href="/store?type=EXTERNAL_HTTP_API&amp;category=social"',
    );
    expect(apiMarkup).not.toContain("vietnamese-data");

    const actorMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "HOSTED_ACTOR" }),
      }),
    );
    expect(actorMarkup).toContain(
      'href="/store?type=HOSTED_ACTOR&amp;category=web-scraping"',
    );
    expect(actorMarkup).toContain(
      'href="/store?type=HOSTED_ACTOR&amp;category=vietnamese-data"',
    );

    const agentMarkup = renderToStaticMarkup(
      await StorePage({
        searchParams: Promise.resolve({ type: "AUTONOMOUS_AGENT" }),
      }),
    );
    expect(agentMarkup).toContain(
      'href="/store?type=AUTONOMOUS_AGENT&amp;category=market-analysis"',
    );
    expect(agentMarkup).toContain(
      'href="/store?type=AUTONOMOUS_AGENT&amp;category=research"',
    );
  });
});

describe("Studio pages", () => {
  it("renders Studio overview and API, Actor, Agent studios using canonical Facet taxonomy without sub-navbar or overview back links", () => {
    const hub = renderToStaticMarkup(<StudioHubPage />);
    const api = renderToStaticMarkup(<ApiStudioPage />);
    const actor = renderToStaticMarkup(<ActorStudioPage />);
    const agent = renderToStaticMarkup(<AgentStudioPage />);

    expect(hub).toContain("Publish a Facet");
    expect(hub).toContain("facet-taxonomy-bar");
    expect(api).toContain("API Studio");
    expect(actor).toContain("Actor Studio");
    expect(agent).toContain("Agent Studio");

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
  it("renders On-Chain Agent Card and breadcrumb for AUTONOMOUS_AGENT", async () => {
    const facetId = "019a69b8-1f36-7a12-9ea4-777f09a777ea";
    vi.stubEnv("FACET_CONTROL_API_URL", "http://127.0.0.1:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          facet: {
            id: facetId,
            versionId: "019a69b8-1f36-7a12-9ea4-777f09a777eb",
            slug: "vn-market-analyst-agent",
            name: "VN Market Analyst",
            description: "Synthesizes sourced datasets.",
            category: "a2a-agents",
            tags: ["a2a"],
            facetType: "AUTONOMOUS_AGENT",
            provider: {
              id: "019a69b8-1f36-7a12-9ea4-777f09a777ec",
              name: "VN Data Studio",
              slug: "vn-data-studio",
            },
            displayVersion: "1.0.0",
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
      await FacetDetailPage({ params: Promise.resolve({ facetId }) }),
    );

    expect(markup).toContain("ON-CHAIN AGENT IDENTITY");
    expect(markup).toContain("Facet · Agent");
    expect(markup).toContain("#7");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/store?type=AUTONOMOUS_AGENT"');
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });
});
