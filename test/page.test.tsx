import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

    // Avalanche branding invariant across full HomePage (including header and footer)
    expect(markup).not.toMatch(/\bfuji\b/iu);

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
    expect(markup).toContain("Paste this setup prompt");
    expect(markup).not.toContain("hidden setup prompt");
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
    expect(markup).toContain(
      'Claim test fUSD on Avalanche Faucet <span aria-hidden="true">↗</span>',
    );
    expect(markup).not.toContain("Claim test fUSD on Avalanche Faucet ↗");
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

  it("enforces >=44px Copy button touch targets and minmax(0, 1fr) grid tracks in docs-home.css", () => {
    const css = readFileSync(
      resolve(process.cwd(), "app/docs-home.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.quickstart-step-card\s+\.docs-code-header\s+\.preset-chip\s*\{[^}]*min-height:\s*44px;[^}]*min-width:\s*44px;/u,
    );
    expect(css).toMatch(
      /\.quickstart-workbench\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u,
    );
    expect(css).toMatch(
      /\.quickstart-panel\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1040px\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u,
    );
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
    expect(allMarkup).toContain("Public Marketplace / Avalanche x402");
    expect(allMarkup).toContain("What is a Facet?");
    expect(allMarkup).toContain("ERC-8004");
    expect(allMarkup).toContain('href="/docs#agent-guide"');
    expect(allMarkup).toContain("Agent &amp; MCP guide");
    expect(allMarkup).not.toContain("MCP &amp; SDK guide");
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

    for (const storeMarkup of [
      allMarkup,
      apiMarkup,
      actorMarkup,
      agentMarkup,
    ]) {
      expect(storeMarkup).not.toMatch(/\bfuji\b/iu);
    }
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
      expect(markup).not.toMatch(/apify|rapidapi/iu);
    }
  });
});

describe("DocsPage documentation", () => {
  it("renders modular 2-part Overview & Agent Setup Guide with ERC-8004, multi-pricing, real CLI/MCP, and all 6 Avalanche contracts", () => {
    const markup = renderToStaticMarkup(<DocsPage />);

    // 2-Part Structure, Semantic Accessibility & Heading Hierarchy
    const mainMarkup = markup.slice(
      markup.indexOf("<main"),
      markup.indexOf("</main>"),
    );
    expect(markup).toContain("FACET Documentation");
    expect(markup).toContain("Part 1");
    expect(markup).toContain("Project Overview");
    expect(markup).toContain("Part 2");
    expect(markup).toContain("User &amp; Agent Guide");
    expect(mainMarkup).toContain(
      '<section class="docs-part-banner docs-part-banner-overview" aria-labelledby="part-overview-title">',
    );
    expect(mainMarkup).toContain('<h2 id="part-overview-title">');
    expect(mainMarkup).toContain(
      '<section class="docs-part-banner docs-part-banner-agent" id="agent-guide" aria-labelledby="part-agent-guide-title">',
    );
    expect(mainMarkup).toContain('<h2 id="part-agent-guide-title">');
    expect(mainMarkup).not.toMatch(/<div[^>]*\baria-label=/u);
    expect(mainMarkup.match(/<h2\b/gu)?.length).toBe(2);
    expect(mainMarkup.match(/<h3\b/gu)?.length).toBe(11);
    expect(markup).toContain('id="overview"');
    expect(markup).toContain('id="facet-types"');
    expect(markup).toContain('id="core-definitions"');
    expect(markup).toContain('id="pricing-escrow"');
    expect(markup).toContain('id="contracts"');
    expect(markup).toContain('id="agent-guide"');
    expect(markup).toContain('id="agent-concepts"');
    expect(markup).toContain('id="install-cli"');
    expect(markup).toContain('id="wallet-faucet"');
    expect(markup).toContain('id="spend-policy"');
    expect(markup).toContain('id="install-mcp"');
    expect(markup).toContain('id="agent-workflow"');

    // Accurate Core Concepts & Multi-Pricing
    expect(markup).toContain("ERC-8004");
    expect(markup).toContain("FacetManifest v1");
    expect(markup).toContain("PAY_PER_RUN");
    expect(markup).toContain("PAY_PER_RESULT");
    expect(markup).toContain("TaskEscrow");
    expect(markup).toContain("maxItemsCap");
    expect(markup).toContain("95%");
    expect(markup).toContain("5%");
    expect(markup).toContain("GET");
    expect(markup).toContain("POST");
    expect(markup).toContain("PUT");
    expect(markup).toContain("PATCH");
    expect(markup).toContain("DELETE");
    expect(markup).toContain("BASIC");
    expect(markup).toContain("datasetPath");
    expect(markup).toContain("FacetActorRegistry");
    expect(markup).toContain("FacetReceiptLog");
    expect(markup).toContain('href="/faucet"');
    expect(markup).toContain(
      '>Open /faucet to claim test fUSD <span aria-hidden="true">↗</span></a>',
    );
    expect(markup).not.toContain("Open /faucet to claim test fUSD ↗");
    expect(markup).not.toMatch(/[^>]↗/u);
    expect(markup).toContain("Wallet-Signed Playground");
    expect(markup).toContain("pre-funded");
    expect(markup).toContain("Avalanche Address");
    expect(markup).toContain("409 IDEMPOTENCY_CONFLICT");
    expect(markup).toContain("PAYMENT-REQUIRED");
    expect(markup).toContain("PAYMENT-SIGNATURE");
    expect(markup).toContain("Coming Soon");

    // Accurate Real CLI & MCP Commands
    expect(markup).toContain("@facet-aex/cli");
    expect(markup).toContain("@facet-aex/mcp-server");
    expect(markup).toContain("https://facet.briandev.space");
    expect(markup).toContain("npm install -g @facet-aex/cli");
    expect(markup).toContain("facet wallet create");
    expect(markup).toContain("facet wallet import");
    expect(markup).toContain("facet wallet status");
    expect(markup).toContain("facet search");
    expect(markup).toContain("facet inspect");
    expect(markup).toContain("facet policy grant");
    expect(markup).toContain("--pricing-model");
    expect(markup).toContain("facet policy show");
    expect(markup).toContain("facet policy revoke");
    expect(markup).toContain("facet policy prune");
    expect(markup).toContain("facet mcp install antigravity");
    expect(markup).toContain("facet mcp install codex");
    expect(markup).toContain("facet mcp install claude");
    expect(markup).toContain("facet mcp config");
    expect(markup).toContain("facet spend history");
    expect(markup).toContain("search_facets");
    expect(markup).toContain("get_facet");
    expect(markup).toContain("invoke_facet");

    // All 6 Verified Avalanche Contract Addresses
    expect(markup).toContain("0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f");
    expect(markup).toContain("0xc37c12bcd53a4ba5fd33870cecc74a4ba601e3a2");
    expect(markup).toContain("0xc50cb5d5ff6c71eb1b065971c198a9edb0ecff06");
    expect(markup).toContain("0x5dc611b5642c306dd50fa7f786194dc04bd12fa7");
    expect(markup).toContain("0x8004A818BFB912233c491871b3d84c89A494BD9e");
    expect(markup).toContain("0x8004B663056A597Dffe9eCcC1965A193B7388713");

    // Stale Content & Brand Ban Assertions
    expect(markup).not.toContain("@facet/agent-sdk");
    expect(markup).not.toContain("@facet/mcp-server");
    expect(markup).not.toContain("127.0.0.1");
    expect(markup).not.toContain("FACET_DEMO_PAYER_PRIVATE_KEY");
    expect(markup).not.toContain("facet grant create");
    expect(markup).not.toContain("FACET_GRANT_TOKEN");
    expect(markup).not.toContain("facet policy list");
    expect(markup).not.toContain("facet publish-actor");
    expect(markup).not.toContain("api.facet.example");
    expect(markup).not.toContain("FacetClient");
    expect(markup).not.toContain("fuji-deployment.json");
    expect(markup).not.toContain("users.username");
    expect(markup).not.toContain("facetVersionId");
    expect(markup).not.toContain("Option B");
    expect(markup).not.toContain("duplicate organization tables");
    expect(markup).not.toMatch(/apify|rapidapi/iu);
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("keeps /docs modules as pure Server Components and enforces >=44px touch targets, heading scale, TOC overflow/sticky rules, and cyan/lime alignment in docs-home.css", () => {
    const serverFiles = [
      "components/docs/docs-data.ts",
      "components/docs/docs-part-overview.tsx",
      "components/docs/docs-part-agent-guide.tsx",
      "app/docs/page.tsx",
    ];
    for (const file of serverFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/["']use client["']/u);
    }

    const css = readFileSync(
      resolve(process.cwd(), "app/docs-home.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.docs-page\s+\.docs-code-header\s+\.preset-chip\s*\{[^}]*min-height:\s*44px;[^}]*min-width:\s*44px;/u,
    );
    expect(css).toMatch(
      /\.docs-toc\s+nav\s+a\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*min-height:\s*44px;/u,
    );
    expect(css).toMatch(
      /\.docs-content\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/u,
    );
    expect(css).toMatch(
      /\.docs-toc\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*112px\);[^}]*overflow-y:\s*auto;/u,
    );
    expect(css).toMatch(
      /\.docs-part-banner\s+h2\s*\{[^}]*font-size:\s*clamp\(1\.8rem,\s*2\.9vw,\s*2\.45rem\);/u,
    );
    expect(css).toMatch(
      /\.docs-section\s+h3\s*\{[^}]*font-size:\s*clamp\(1\.35rem,\s*2\.2vw,\s*1\.85rem\);/u,
    );
    expect(css).toMatch(
      /\.docs-toc-group-label\s*\{[^}]*color:\s*var\(--facet-cyan\);/u,
    );
    expect(css).toMatch(
      /\.docs-toc-group:last-child\s+\.docs-toc-group-label\s*\{[^}]*color:\s*var\(--facet-lime\);/u,
    );
    expect(css).toMatch(
      /\.docs-part-banner-overview\s*\{[^}]*border-top:\s*3px\s+solid\s+var\(--facet-cyan\);/u,
    );
    expect(css).toMatch(
      /\.docs-part-banner-agent\s*\{[^}]*border-top:\s*3px\s+solid\s+var\(--facet-lime\);/u,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1120px\)\s*\{[\s\S]*?\.docs-section,\s*\.docs-part-banner\s*\{[^}]*scroll-margin-top:\s*148px;/u,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1120px\)\s*\{[\s\S]*?\.docs-toc\s*\{[^}]*top:\s*144px;[^}]*max-height:\s*calc\(100dvh\s*-\s*160px\);/u,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*1040px\)\s*\{[\s\S]*?\.docs-toc\s*\{[^}]*position:\s*static;[^}]*max-height:\s*none;[^}]*overflow-y:\s*visible;/u,
    );
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
    expect(markup).not.toMatch(/apify|rapidapi/iu);
  });
});
