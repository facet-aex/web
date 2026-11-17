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
  it("renders a focused landing page with CTAs to Store, Studio, and Docs and no embedded studio forms", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("Federated Agent Capability Exchange &amp; Trust");
    expect(markup).not.toContain(
      "Federated Agent Capability Exchange &amp; Trust —",
    );
    expect(markup).toContain("Find the missing");
    expect(markup).toContain("facet-taxonomy-bar");
    expect(markup).toContain("API, Actor &amp; Agent — All Are Facets.");
    expect(markup).not.toContain("External HTTP API");
    expect(markup).not.toContain("Hosted Actor");
    expect(markup).not.toContain("ERC-8004 A2A Agent");
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
    }
  });
});

describe("DocsPage documentation", () => {
  it("renders structured sections, Agent Integration guide, and verified Fuji contracts", () => {
    const markup = renderToStaticMarkup(<DocsPage />);

    expect(markup).toContain("FACET Documentation");
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

    expect(markup).toContain("ERC-8004 ON-CHAIN IDENTITY");
    expect(markup).toContain("Facet · Agent");
    expect(markup).toContain("#7");
    expect(markup).toContain("vn-market-analysis");
    expect(markup).toContain('href="/store"');
    expect(markup).toContain('href="/store?type=AUTONOMOUS_AGENT"');
  });
});
