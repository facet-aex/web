"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type JSX } from "react";

import { CopyCodeBlock } from "@/components/copy-code-block";

export type QuickstartChoice = "prompt" | "manual" | null;

export interface LandingQuickstartProps {
  initialSelection?: QuickstartChoice;
}

const AGENT_SETUP_PROMPT = `Set up FACET against https://facet.briandev.space so this client can discover and invoke APIs, Actors, and Agents safely over MCP:

1. Check that Node >= 22 is active, then install the FACET CLI globally:
   npm install -g @facet-aex/cli

2. Create a local Avalanche payer wallet stored in the protected OS credential store (macOS Keychain — never print or embed raw private keys in prompts or config) and inspect its address and balance:
   facet wallet create
   facet wallet status

3. Ask me to fund that wallet address with test fUSD on Avalanche at https://facet.briandev.space/faucet and wait until I confirm it is funded.

4. Install the FACET MCP server (@facet-aex/mcp-server) for this client (zero secrets written into MCP config, targeting https://facet.briandev.space):
   - Antigravity: facet mcp install antigravity
   - Codex: facet mcp install codex
   - Claude Code: facet mcp install claude
   - Cursor or other MCP hosts: print the mcpServers JSON with \`facet mcp config antigravity\` and configure it there

5. Note that FACET enforces a Default-Deny Spend Policy: before any paid invocation, discover and inspect a capability (\`facet search\`, \`facet inspect <provider>/<facet-name>\`), authorize a bounded policy (\`facet policy grant --facet <provider>/<facet-name> --version <semver> --max-per-run <atomic> --daily-cap <atomic>\`), and verify MCP discovery by calling \`search_facets\`.`;

export function getAgentSetupPrompt(): string {
  return AGENT_SETUP_PROMPT;
}

export async function copyAgentSetupPrompt(
  clipboard?: Pick<Clipboard, "writeText"> | null,
): Promise<boolean> {
  const target =
    clipboard === undefined ? globalThis.navigator?.clipboard : clipboard;
  if (!target || typeof target.writeText !== "function") {
    return false;
  }

  try {
    await target.writeText(AGENT_SETUP_PROMPT);
    return true;
  } catch {
    return false;
  }
}

/**
 * Two-choice Home Quick Start letting users choose either a one-click hidden
 * agent setup prompt or a minimal 3-step manual CLI, wallet, and MCP flow.
 */
export function LandingQuickstart({
  initialSelection = null,
}: LandingQuickstartProps = {}): JSX.Element {
  const [selection, setSelection] =
    useState<QuickstartChoice>(initialSelection);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function selectChoice(choice: Exclude<QuickstartChoice, null>) {
    setCopyState("idle");
    setSelection((current) => (current === choice ? null : choice));
  }

  async function handleCopyPrompt() {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
    }
    const ok = await copyAgentSetupPrompt();
    setCopyState(ok ? "copied" : "error");
    if (ok) {
      resetTimerRef.current = setTimeout(() => {
        setCopyState("idle");
        resetTimerRef.current = null;
      }, 2200);
    }
  }

  return (
    <div className="quickstart-workbench">
      <div
        className="quickstart-choice-grid"
        role="group"
        aria-label="Choose your FACET onboarding path"
      >
        <button
          type="button"
          id="quickstart-choice-prompt"
          aria-pressed={selection === "prompt"}
          aria-expanded={selection === "prompt"}
          aria-controls="quickstart-panel-prompt"
          className={
            selection === "prompt"
              ? "quickstart-choice-btn is-active"
              : "quickstart-choice-btn"
          }
          onClick={() => selectChoice("prompt")}
        >
          <span className="quickstart-choice-top">
            <span className="quickstart-choice-kicker">
              01 · Recommended for AI Hosts
            </span>
            <span className="quickstart-choice-badge is-lime">One Click</span>
          </span>
          <span className="quickstart-choice-title">Prompt</span>
          <span className="quickstart-choice-desc">
            Copy one curated setup prompt into Antigravity, Codex, Claude Code,
            or Cursor
          </span>
        </button>

        <button
          type="button"
          id="quickstart-choice-manual"
          aria-pressed={selection === "manual"}
          aria-expanded={selection === "manual"}
          aria-controls="quickstart-panel-manual"
          className={
            selection === "manual"
              ? "quickstart-choice-btn is-active"
              : "quickstart-choice-btn"
          }
          onClick={() => selectChoice("manual")}
        >
          <span className="quickstart-choice-top">
            <span className="quickstart-choice-kicker">
              02 · Step-by-Step Terminal
            </span>
            <span className="quickstart-choice-badge">3 Steps</span>
          </span>
          <span className="quickstart-choice-title">Manual</span>
          <span className="quickstart-choice-desc">
            Install the CLI, fund a local wallet on Avalanche, and connect MCP
          </span>
        </button>
      </div>

      {selection === "prompt" ? (
        <div
          id="quickstart-panel-prompt"
          className="quickstart-panel quickstart-prompt-panel"
          role="region"
          aria-labelledby="quickstart-choice-prompt"
        >
          <div className="quickstart-prompt-copy">
            <h3>Copy One Setup Prompt Into Your Agent</h3>
            <p className="quickstart-copy">
              Paste this hidden setup prompt into your coding agent session to
              walk through CLI installation, local wallet creation, fUSD faucet
              funding, MCP setup, and spend-policy verification.
            </p>
          </div>

          <div className="quickstart-prompt-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleCopyPrompt()}
            >
              {copyState === "copied" ? "Copied ✓" : "Copy Setup Prompt"}
            </button>
            {copyState === "copied" ? (
              <p className="quickstart-copy-feedback" role="status">
                Prompt copied to clipboard. Paste it into your AI coding host.
              </p>
            ) : null}
            {copyState === "error" ? (
              <p className="quickstart-copy-feedback is-error" role="status">
                Clipboard access is unavailable in this browser context. Choose
                Manual to copy commands step by step.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selection === "manual" ? (
        <div
          id="quickstart-panel-manual"
          className="quickstart-panel quickstart-manual-panel"
          role="region"
          aria-labelledby="quickstart-choice-manual"
        >
          <ol className="quickstart-manual-steps">
            <li className="quickstart-step-card">
              <div className="quickstart-step-head">
                <span className="quickstart-step-num">01</span>
                <h3>Install CLI</h3>
                <span className="quickstart-step-meta">Node &gt;= 22</span>
              </div>
              <p className="quickstart-copy">
                Install the published FACET CLI globally and verify available
                commands.
              </p>
              <CopyCodeBlock
                title="Install @facet-aex/cli"
                code={`npm install -g @facet-aex/cli\nfacet --help`}
              />
            </li>

            <li className="quickstart-step-card">
              <div className="quickstart-step-head">
                <span className="quickstart-step-num">02</span>
                <h3>Setup Wallet &amp; Claim fUSD</h3>
                <span className="quickstart-step-meta">OS Keychain</span>
              </div>
              <p className="quickstart-copy">
                Create a local Avalanche wallet in protected macOS Keychain
                storage without printing raw keys, then fund it.
              </p>
              <CopyCodeBlock
                title="Create & Inspect Wallet"
                code={`facet wallet create\nfacet wallet status`}
              />
              <div className="quickstart-faucet-callout">
                <Link className="explorer-link" href="/faucet">
                  Claim test fUSD on Avalanche Faucet ↗
                </Link>
              </div>
            </li>

            <li className="quickstart-step-card">
              <div className="quickstart-step-head">
                <span className="quickstart-step-num">03</span>
                <h3>Install MCP</h3>
                <span className="quickstart-step-meta">
                  Zero Keys in Config
                </span>
              </div>
              <p className="quickstart-copy">
                Register FACET tools in your AI host, or print standard{" "}
                <code>mcpServers</code> JSON for Cursor and other MCP clients.
              </p>
              <CopyCodeBlock
                title="Connect MCP Client"
                code={`facet mcp install antigravity\nfacet mcp install codex\nfacet mcp install claude\n\n# Cursor or other MCP hosts — print mcpServers JSON:\nfacet mcp config antigravity`}
              />
            </li>
          </ol>

          <div className="landing-cta-buttons">
            <Link className="button button-primary" href="/faucet">
              Claim fUSD <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" href="/store">
              Browse Facet Store <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-ghost" href="/docs#agent-guide">
              Full Agent &amp; MCP Guide <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
