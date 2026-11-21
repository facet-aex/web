import Link from "next/link";

import { CopyCodeBlock } from "@/components/copy-code-block";
import {
  AGENT_WORKFLOW_STEPS,
  BUYER_SAFETY_PILLARS,
  DOCS_CODE_SNIPPETS,
} from "@/components/docs/docs-data";

/**
 * Server Component rendering Part 2 of /docs in plain end-user language,
 * preserving #agent-guide for inbound links from Store and Home Quick Start.
 */
export function DocsPartAgentGuide() {
  return (
    <>
      <section
        className="docs-part-banner docs-part-banner-agent"
        id="agent-guide"
        aria-labelledby="part-agent-guide-title"
      >
        <p className="eyebrow">Part 2 · User &amp; Agent Guide</p>
        <h2 id="part-agent-guide-title">
          Connect Your Wallet, Set Spending Limits &amp; Add Your AI App
        </h2>
        <p>
          Follow five simple steps to create a protected wallet, claim free test
          fUSD, set a budget limit for your AI agent, and connect Antigravity,
          Codex, Claude Code, or Cursor without sharing private keys.
        </p>
      </section>

      <section className="docs-section" id="agent-concepts">
        <p className="eyebrow">06 · Wallet Safety</p>
        <h3>How Your AI Agent Spends Safely Without Holding Your Keys</h3>
        <p>
          Your AI assistant can discover tools and ask to run them, while your
          own computer handles signing and enforces every spending limit you
          approve.
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
            <span className="docs-step-badge">07 · Install the CLI</span>
            <h3>Install the FACET CLI</h3>
          </div>
          <p>
            Install the FACET command-line tool once on your computer (requires
            Node.js 22 or newer). You will use it to manage your wallet, approve
            spending limits, and connect your AI coding app.
          </p>
          <CopyCodeBlock
            title="Install the FACET CLI"
            code={DOCS_CODE_SNIPPETS.installCli}
          />
        </div>
      </section>

      <section className="docs-section" id="wallet-faucet">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">08 · Wallet &amp; Free fUSD</span>
            <h3>Create a Protected Wallet &amp; Claim Free fUSD</h3>
          </div>
          <p>
            Create a local Avalanche wallet inside{" "}
            <strong>macOS Keychain</strong>—your private key is never printed to
            the screen. Prefer using an existing test wallet? Run the import
            command and enter your key privately at the secure prompt.
          </p>
          <CopyCodeBlock
            title="Create or import a local wallet"
            code={DOCS_CODE_SNIPPETS.walletSetup}
          />
          <div className="docs-inline-note">
            <strong>Get Free Test fUSD:</strong> Open the{" "}
            <Link className="explorer-link" href="/faucet">
              Avalanche Faucet
            </Link>{" "}
            and paste your wallet address to receive 1 fUSD per day per wallet
            (up to 10 claims per day per network address). Because FACET
            payments are gasless for buyers, free test fUSD is all you need to
            start running tools.
          </div>
        </div>
      </section>

      <section className="docs-section" id="spend-policy">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">09 · Spending Limits</span>
            <h3>Browse Tools &amp; Approve a Budget Cap</h3>
          </div>
          <p>
            Everything is <strong>locked by default</strong> so an AI agent can
            never make an unapproved purchase. Browse the{" "}
            <Link className="explorer-link" href="/store">
              FACET Marketplace
            </Link>{" "}
            or search from your terminal, check the price, and approve a maximum
            cost per run and per day. You can review or turn off permissions at
            any time.
          </p>
          <CopyCodeBlock
            title="Search tools & set a spending limit"
            code={DOCS_CODE_SNIPPETS.discoverAndGrant}
          />
          <CopyCodeBlock
            title="Check or revoke spending limits"
            code={DOCS_CODE_SNIPPETS.managePolicies}
          />
        </div>
      </section>

      <section className="docs-section" id="install-mcp">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">10 · Connect Your AI App</span>
            <h3>Connect FACET to Your AI Coding App</h3>
          </div>
          <p>
            Run the setup command for Antigravity, Codex, or Claude Code, or
            generate standard MCP configuration to paste into Cursor or another
            compatible AI host. The saved settings contain zero private keys.
          </p>
          <CopyCodeBlock
            title="Connect automatically or print setup JSON"
            code={DOCS_CODE_SNIPPETS.mcpInstall}
          />
          <CopyCodeBlock
            title="Standard MCP config (Cursor / Antigravity / Claude)"
            code={DOCS_CODE_SNIPPETS.mcpConfigJson}
          />
        </div>
      </section>

      <section className="docs-section" id="agent-workflow">
        <div className="docs-step-block">
          <div className="docs-step-head">
            <span className="docs-step-badge">11 · Using Your Agent</span>
            <h3>Run Paid Tools &amp; Track Spending History</h3>
          </div>
          <p>
            Once connected, your AI assistant handles discovery, price checks,
            and verified execution in three steps:
          </p>
          <div className="docs-tool-grid">
            {AGENT_WORKFLOW_STEPS.map((step) => (
              <article className="docs-tool-card" key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </article>
            ))}
          </div>

          <div className="docs-inline-note">
            <strong>Try asking your agent:</strong>{" "}
            <em>
              &ldquo;Find Vietnam gold prices on FACET, check the pricing first,
              and fetch the latest SJC rates within my spending limit.&rdquo;
            </em>
          </div>

          <p>
            You can check every payment, active escrow hold, and automatic
            refund on your computer anytime using the spending history command:
          </p>
          <CopyCodeBlock
            title="View payments & automatic refunds"
            code={DOCS_CODE_SNIPPETS.spendHistory}
          />
          <p>
            Every pay-per-result deposit also carries a maximum lock window of 15
            minutes. If settlement stalls past 15 minutes, version 0.4.0 lets
            anyone check status and reclaim locked funds back to the payer
            directly on Avalanche without waiting for FACET servers:
          </p>
          <CopyCodeBlock
            title="Check or reclaim an expired escrow directly on Avalanche"
            code={DOCS_CODE_SNIPPETS.reclaimEscrow}
          />
          <p>
            Upgrading from an older client release? Install version 0.4.0 and
            re-grant your spending policy once so local records point to the
            hardened escrow settlement contract.
          </p>
        </div>
      </section>
    </>
  );
}
