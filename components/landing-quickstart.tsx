"use client";

import Link from "next/link";
import { useState } from "react";

import { CopyCodeBlock } from "@/components/copy-code-block";

interface ManualTab {
  id: "cli-grant" | "mcp" | "sdk" | "publish";
  label: string;
  blockTitle: string;
  caption: string;
  code: string;
}

const AGENT_SETUP_PROMPT = `Set up FACET so this workspace can discover, pay for, and invoke external APIs, Actors, and Agents via MCP:

1. Install the FACET CLI & SDK globally:
   npm install -g @facet/agent-sdk

2. Provision a non-custodial agent wallet and a scoped spending grant (never expose raw private keys inside prompts or code):
   facet wallet create --agent workspace-agent
   facet grant create --agent workspace-agent --max-per-call 0.05 --budget 5.00 --allow api,actor,agent

3. Register the @facet/mcp-server MCP server (npx -y @facet/mcp-server) in my MCP configuration with the generated FACET_GRANT_TOKEN.

4. Verify connectivity by running search_facets and listing 3 matching Facets from the catalog.`;

const MANUAL_TABS: readonly ManualTab[] = [
  {
    id: "cli-grant",
    label: "CLI & Grant",
    blockTitle: "Install CLI, Create Wallet & Grant Authority",
    caption:
      "Install @facet/agent-sdk, create an isolated wallet, and issue a bounded spend grant.",
    code: `# 1. Install the FACET CLI & SDK
npm install -g @facet/agent-sdk

# 2. Create a wallet & bounded spending grant (zero keys in prompts)
facet wallet create --agent my-agent
facet grant create --agent my-agent --max-per-call 0.05 --budget 5.00

# 3. Search & inspect capabilities in the catalog
facet search "market data"
facet inspect <provider> <facetName>`,
  },
  {
    id: "mcp",
    label: "MCP Config",
    blockTitle: "MCP Client Configuration (Claude · Cursor · Codex)",
    caption:
      "Attach FACET's discovery and x402 execution tools to any MCP-compatible host.",
    code: `{
  "mcpServers": {
    "facet": {
      "command": "npx",
      "args": ["-y", "@facet/mcp-server"],
      "env": {
        "FACET_GRANT_TOKEN": "<paste-your-grant-token>"
      }
    }
  }
}`,
  },
  {
    id: "sdk",
    label: "TypeScript SDK",
    blockTitle: "TypeScript Client (@facet/agent-sdk)",
    caption:
      "Call any published API, Actor, or Agent directly from application code.",
    code: `import { FacetClient } from "@facet/agent-sdk";

const facet = new FacetClient({
  grantToken: process.env.FACET_GRANT_TOKEN,
});

const [tool] = await facet.searchFacets({ query: "gold price" });
const run = await facet.invokeFacet(
  tool.provider,
  tool.facetName,
  tool.version,
  { brand: "SJC" },
);
console.log(run.dataset, run.receiptTxHash);`,
  },
  {
    id: "publish",
    label: "Publish",
    blockTitle: "Publish a Facet From CLI",
    caption:
      "Deploy an Actor, endpoint, or Agent card in one command or inside Studio.",
    code: `# Validate and deploy an Actor module straight to the catalog
facet publish-actor --file ./actor-manifest.json`,
  },
];

/**
 * Two-path onboarding workbench letting users either paste one setup prompt to
 * their coding agent or copy manual CLI, Spending Grant, MCP, and SDK snippets.
 */
export function LandingQuickstart() {
  const [activeTabId, setActiveTabId] = useState<ManualTab["id"]>("cli-grant");
  const activeTab =
    MANUAL_TABS.find((tab) => tab.id === activeTabId) ?? MANUAL_TABS[0];

  return (
    <div className="quickstart-grid">
      <article className="quickstart-card quickstart-card-prompt">
        <div className="quickstart-card-head">
          <span className="quickstart-pill is-lime">
            OPTION 01 · FASTEST PATH
          </span>
          <span className="quickstart-hosts">
            Claude · Cursor · Codex · Antigravity
          </span>
        </div>

        <h3>Paste Prompt to Your Agent</h3>
        <p className="quickstart-copy">
          Let your AI coding assistant handle setup in one shot. Paste this
          prompt and your agent installs the CLI, creates a scoped spending
          grant, wires up MCP, and verifies catalog discovery.
        </p>

        <CopyCodeBlock title="Agent Setup Prompt" code={AGENT_SETUP_PROMPT} />

        <ul className="quickstart-checklist">
          <li>Installs CLI &amp; SDK</li>
          <li>Creates Capped Wallet Grant</li>
          <li>Connects FACET MCP Tools</li>
        </ul>
      </article>

      <article className="quickstart-card quickstart-card-manual">
        <div className="quickstart-card-head">
          <span className="quickstart-pill">OPTION 02 · MANUAL SETUP</span>
          <span className="quickstart-hosts">CLI · Grant · MCP · SDK</span>
        </div>

        <h3>Install CLI, Grant, MCP &amp; SDK</h3>
        <p className="quickstart-copy">{activeTab.caption}</p>

        <div
          className="quickstart-tabs"
          role="tablist"
          aria-label="Manual installation steps"
        >
          {MANUAL_TABS.map((tab) => {
            const selected = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`qs-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`qs-panel-${tab.id}`}
                className={
                  selected ? "quickstart-tab is-active" : "quickstart-tab"
                }
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`qs-panel-${activeTab.id}`}
          aria-labelledby={`qs-tab-${activeTab.id}`}
        >
          <CopyCodeBlock title={activeTab.blockTitle} code={activeTab.code} />
        </div>

        <div className="landing-cta-buttons">
          <Link className="button button-primary" href="/store">
            Browse Facet Store <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button button-secondary" href="/studio">
            Publish in Studio <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button button-ghost" href="/docs#agent-guide">
            Full Docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </div>
  );
}
