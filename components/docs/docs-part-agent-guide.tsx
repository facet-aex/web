import Link from "next/link";

import { CopyCodeBlock } from "@/components/copy-code-block";
import {
  BUYER_SAFETY_PILLARS,
  DOCS_CODE_SNIPPETS,
  MCP_TOOL_CARDS,
} from "@/components/docs/docs-data";

/**
 * Server Component rendering Part 2 of /docs: User & Agent Setup Guide
 * preserving #agent-guide for inbound links from /store and Home Quickstart.
 */
export function DocsPartAgentGuide() {
  return (
    <>
      <div
        className="docs-part-banner docs-part-banner-agent"
        id="agent-guide"
        aria-label="Part 2: User and Agent Setup Guide"
      >
        <p className="eyebrow">Part 2 · User &amp; Agent Guide</p>
        <h2>Set Up CLI, Keychain Wallet, Spend Policies &amp; MCP</h2>
        <p>
          Configure your local Avalanche buyer wallet, claim test{" "}
          <code>fUSD</code> from the Faucet, authorize bounded per-Facet spend
          policies, and connect Antigravity, Codex, Claude Code, or Cursor with
          zero private keys in MCP config.
        </p>
      </div>

      <section className="docs-section" id="agent-concepts">
        <p className="eyebrow">06 · Buyer Safety Model</p>
        <h2>How Agents Spend Safely Without Holding Secrets</h2>
        <p>
          The FACET agent runtime enforces strict separation between AI
          reasoning and Avalanche signing authority: your agent discovers and
          calls tools via MCP while your local CLI controls keys and spend
          limits.
        </p>
        <div className="docs-glossary-grid">
          {BUYER_SAFETY_PILLARS.map((pillar) => (
            <article className="docs-glossary-card" key={pillar.title}>
              <div className="docs-glossary-head">
                <strong>{pillar.title}</strong>
                <span className="docs-step-badge">{pillar.badge}</span>
              </div>
              <p>{pillar.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="docs-section" id="install-cli">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">07 · Install CLI</span>
            <h2>Install @facet-aex/cli (Node &gt;= 22)</h2>
          </div>
          <p>
            Install the official CLI globally. Commands target{" "}
            <code>https://facet.briandev.space</code> by default, print clean
            human-readable output, and accept <code>--json</code> for
            automation.
          </p>
          <CopyCodeBlock
            title="Install @facet-aex/cli"
            code={DOCS_CODE_SNIPPETS.installCli}
          />
        </div>
      </section>

      <section className="docs-section" id="wallet-faucet">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">08 · Wallet &amp; Faucet</span>
            <h2>Create a Keychain Wallet &amp; Claim Test fUSD</h2>
          </div>
          <p>
            Generate an isolated Avalanche EOA inside{" "}
            <strong>macOS Keychain</strong> (<code>/usr/bin/security</code>) or
            import an existing key through a hidden prompt—raw key flags such as{" "}
            <code>--private-key</code> are intentionally rejected. Use{" "}
            <code>--profile &lt;name&gt;</code> whenever you need isolated
            environments.
          </p>
          <CopyCodeBlock
            title="Create, import & inspect local wallet"
            code={DOCS_CODE_SNIPPETS.walletSetup}
          />
          <div className="docs-inline-note">
            <strong>Fund with Test fUSD:</strong> Open{" "}
            <Link className="explorer-link" href="/faucet">
              /faucet
            </Link>{" "}
            and paste your wallet address to receive <code>1 fUSD</code> (
            <code>1000000</code> atomic) every <code>24h</code> per address (
            <code>10</code> claims / <code>24h</code> per IP), transferred from
            a pre-funded Avalanche faucet wallet. Because x402 EIP-3009
            settlement is gasless for callers, you only need <code>fUSD</code>{" "}
            to start invoking Facets.
          </div>
        </div>
      </section>

      <section className="docs-section" id="spend-policy">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">09 · Spend Policy</span>
            <h2>Discover, Inspect &amp; Grant Bounded Policies</h2>
          </div>
          <p>
            Policies are <strong>default-deny</strong>: inspect a Facet&apos;s
            schema, <code>pricingOptions[]</code>, and{" "}
            <code>providerPayTo</code> first, then grant an explicit cap (
            <code>1 fUSD = 1000000</code> atomic; <code>0.001 fUSD = 1000</code>{" "}
            atomic) optionally scoped to{" "}
            <code>--pricing-model PAY_PER_RUN</code> or{" "}
            <code>PAY_PER_RESULT</code>.
          </p>
          <CopyCodeBlock
            title="Search, inspect & authorize spend policy"
            code={DOCS_CODE_SNIPPETS.discoverAndGrant}
          />
          <CopyCodeBlock
            title="Inspect, revoke & prune policies"
            code={DOCS_CODE_SNIPPETS.managePolicies}
          />
        </div>
      </section>

      <section className="docs-section" id="install-mcp">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">10 · Install MCP</span>
            <h2>Connect @facet-aex/mcp-server to Your AI Host</h2>
          </div>
          <p>
            Install <code>@facet-aex/mcp-server</code> directly for Antigravity,
            Codex, or Claude Code, or print standard{" "}
            <code>mcpServers.facet</code> JSON for Cursor and other MCP clients.
            Generated configs point solely to{" "}
            <code>https://facet.briandev.space</code> and contain zero private
            keys.
          </p>
          <CopyCodeBlock
            title="Install or export MCP config"
            code={DOCS_CODE_SNIPPETS.mcpInstall}
          />
          <CopyCodeBlock
            title="Standard mcpServers JSON (Cursor / Antigravity / Claude)"
            code={DOCS_CODE_SNIPPETS.mcpConfigJson}
          />
        </div>
      </section>

      <section className="docs-section" id="agent-workflow">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">11 · Agent Workflow</span>
            <h2>MCP Tools, Example Prompt &amp; Spend History</h2>
          </div>
          <p>
            Once connected, your AI agent follows the deterministic 3-tool
            execution loop below:
          </p>
          <div className="docs-tool-grid">
            {MCP_TOOL_CARDS.map((tool) => (
              <article className="docs-tool-card" key={tool.name}>
                <code>{tool.name}</code>
                <p>
                  <strong>Inputs:</strong> <code>{tool.inputs}</code>
                </p>
                <p>{tool.description}</p>
              </article>
            ))}
          </div>

          <div className="docs-inline-note">
            <strong>Try this prompt in your agent:</strong>{" "}
            <em>
              &ldquo;Use FACET MCP to search_facets for Vietnam gold prices,
              inspect schema and pricing with get_facet, and call invoke_facet
              with SJC input under my granted spend policy.&rdquo;
            </em>
          </div>

          <p>
            Reconcile every reservation, settled payment, <code>502</code>{" "}
            release, and <code>PAY_PER_RESULT</code> escrow refund locally with{" "}
            <code>facet spend history</code> (statuses: <code>SETTLED</code>,{" "}
            <code>PENDING</code>, <code>RELEASED</code>, <code>FAILED</code>):
          </p>
          <CopyCodeBlock
            title="Audit spend & TaskEscrow history"
            code={DOCS_CODE_SNIPPETS.spendHistory}
          />
        </div>
      </section>
    </>
  );
}
