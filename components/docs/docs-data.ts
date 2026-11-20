import {
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  FUJI_CONTRACTS,
} from "@/lib/facet-ui";
import type { FacetType } from "@/lib/identifiers";

export interface DocsTocItem {
  id: string;
  label: string;
}

export interface DocsTocGroup {
  id: string;
  label: string;
  items: readonly DocsTocItem[];
}

export interface ModalityMatrixRow {
  facetType: FacetType;
  label: string;
  howItWorks: string;
  trustGuarantee: string;
  pricingModels: string;
  studioHref: string;
  studioLabel: string;
}

export interface CoreDefinitionItem {
  term: string;
  badge: string;
  summary: string;
  href?: string;
  linkLabel?: string;
}

export interface AvalancheContractRow {
  name: string;
  address: string;
  role: string;
}

export interface BuyerSafetyPillar {
  title: string;
  badge: string;
  summary: string;
}

export interface AgentWorkflowStep {
  title: string;
  description: string;
}

export interface DocsCodeSnippets {
  installCli: string;
  walletSetup: string;
  discoverAndGrant: string;
  managePolicies: string;
  mcpInstall: string;
  mcpConfigJson: string;
  spendHistory: string;
}

export const DOCS_TOC_GROUPS: readonly DocsTocGroup[] = [
  {
    id: "part-overview",
    label: "Part 1 · Understanding FACET",
    items: [
      { id: "overview", label: "01 · What is FACET" },
      { id: "facet-types", label: "02 · API, Actor & Agent" },
      { id: "core-definitions", label: "03 · Key Concepts" },
      { id: "pricing-escrow", label: "04 · Pricing & Refunds" },
      { id: "contracts", label: "05 · Verified Contracts" },
    ],
  },
  {
    id: "part-agent-guide",
    label: "Part 2 · User & Agent Guide",
    items: [
      { id: "agent-guide", label: "06 · Wallet Safety" },
      { id: "install-cli", label: "07 · Install the CLI" },
      { id: "wallet-faucet", label: "08 · Wallet & Free fUSD" },
      { id: "spend-policy", label: "09 · Spending Limits" },
      { id: "install-mcp", label: "10 · Connect Your AI App" },
      { id: "agent-workflow", label: "11 · Using Your Agent" },
    ],
  },
];

export const MODALITY_MATRIX_ROWS: readonly ModalityMatrixRow[] = [
  {
    facetType: "API",
    label: "API",
    howItWorks:
      "Connects your AI agent directly to an existing online service through FACET, keeping any provider credentials sealed on the server.",
    trustGuarantee:
      "Every run verifies payment first, checks that the response matches the published format, and records a tamper-evident receipt.",
    pricingModels: "Pay Per Run or Pay Per Result",
    studioHref: "/studio/api",
    studioLabel: "Open API Studio",
  },
  {
    facetType: "ACTOR",
    label: "Actor",
    howItWorks:
      "Runs a dedicated cloud task inside a strictly isolated sandbox environment with capped memory, runtime limits, and clean structured table output.",
    trustGuarantee:
      "The published code is fingerprinted and verified on Avalanche before going live, alongside signed result counts for every run.",
    pricingModels: "Pay Per Run or Pay Per Result",
    studioHref: "/studio/actor",
    studioLabel: "Open Actor Studio",
  },
  {
    facetType: "AGENT",
    label: "Agent",
    howItWorks:
      "Delegates multi-step research or analysis to an autonomous AI agent that returns structured findings together with supporting citations.",
    trustGuarantee:
      "Each published Agent carries a portable ERC-8004 on-chain identity and reputation record on Avalanche with verifiable execution receipts.",
    pricingModels: "Pay Per Run or Pay Per Result",
    studioHref: "/studio/agent",
    studioLabel: "Agent Studio (Coming Soon)",
  },
];

export const CORE_DEFINITIONS: readonly CoreDefinitionItem[] = [
  {
    term: "Facet",
    badge: "Unified Capability",
    summary:
      "Any API, cloud Actor, or autonomous Agent listed on FACET. Every tool publishes clear inputs, expected outputs, upfront pricing, and a locked release version so you know what your agent is buying before it spends.",
  },
  {
    term: "Pay-As-You-Go Payments",
    badge: "No Subscriptions",
    summary:
      "Your AI agent only pays for the exact runs it performs in fUSD stablecoin. Automatic protections prevent double-charging if a request retries or completes in the background.",
  },
  {
    term: "fUSD & Free Test Faucet",
    badge: "Zero Gas for Buyers",
    summary:
      "All capability runs settle in fUSD on Avalanche. Because authorizations are gasless for buyers, you do not need AVAX gas tokens in your agent wallet—just claim 1 free test fUSD every 24 hours from the faucet.",
    href: "/faucet",
    linkLabel: "Claim free test fUSD on the Avalanche Faucet",
  },
  {
    term: "Browser Playground",
    badge: "Self-Signed",
    summary:
      "Every listing page includes an interactive Browser Playground where you can connect a browser wallet, approve a single test payment yourself, and inspect live outputs right away.",
  },
  {
    term: "Verifiable Receipts",
    badge: "On-Chain Proof",
    summary:
      "After each completed run, FACET writes a permanent Avalanche receipt linking your run ID, item count, and settlement transaction so results and payouts can always be audited.",
  },
  {
    term: "ERC-8004 Agent Trust",
    badge: "Avalanche Standard",
    summary:
      "Autonomous Agents register under the shared ERC-8004 Identity and Reputation registries on Avalanche, giving independent AI apps a transparent way to verify Agent credentials.",
  },
];

export const AVALANCHE_CONTRACTS: readonly AvalancheContractRow[] = [
  {
    name: "fUSD Stablecoin",
    address: FUJI_CONTRACTS.fusd,
    role: "Stablecoin token used to pay for capability runs and fund test wallets from the faucet.",
  },
  {
    name: "Capability Registry",
    address: FUJI_CONTRACTS.actorRegistry,
    role: "Stores the verified fingerprint, pricing summary, payout wallet, and ERC-8004 identity link for published tools.",
  },
  {
    name: "Payment Split & Escrow",
    address: FUJI_CONTRACTS.feeSplitAndEscrow,
    role: "Routes 95% of each fixed-price payment to the creator, 5% to the platform, and refunds unused escrow balances automatically.",
  },
  {
    name: "Execution Receipt Log",
    address: FUJI_CONTRACTS.receiptLog,
    role: "Records public on-chain execution receipts with item counts and signed proof of completion.",
  },
  {
    name: "ERC-8004 Agent Identity",
    address: ERC8004_IDENTITY_REGISTRY,
    role: "Shared Avalanche registry anchoring verified on-chain identities for autonomous Agents.",
  },
  {
    name: "ERC-8004 Agent Reputation",
    address: ERC8004_REPUTATION_REGISTRY,
    role: "Shared Avalanche registry tracking verifiable feedback and trust history across AI Agents.",
  },
];

export const BUYER_SAFETY_PILLARS: readonly BuyerSafetyPillar[] = [
  {
    title: "Protected Keychain Storage",
    badge: "macOS Keychain",
    summary:
      "Your wallet signing key stays inside your computer's protected macOS Keychain. It is never placed inside AI host configuration files, chat prompts, or command history.",
  },
  {
    title: "Locked by Default",
    badge: "Zero Surprise Charges",
    summary:
      "Your AI agent cannot spend anything until you explicitly approve a specific tool, a locked version, and a verified creator payout wallet.",
  },
  {
    title: "Per-Run & Daily Caps",
    badge: "Auto-Refunded",
    summary:
      "Every payment checks your per-run limit and daily budget before signing. Failed runs and unused escrow deposits return to your remaining budget automatically.",
  },
  {
    title: "Pricing Control",
    badge: "Your Choice",
    summary:
      "When a tool supports both fixed-price runs and pay-per-result escrow, you decide which pricing method your agent is allowed to use within your approved cap.",
  },
];

export const AGENT_WORKFLOW_STEPS: readonly AgentWorkflowStep[] = [
  {
    title: "01 · Search the Marketplace",
    description:
      "Your AI agent searches FACET by keyword, category, or tool type to find matching APIs, Actors, and Agents along with live pricing.",
  },
  {
    title: "02 · Check Details & Price",
    description:
      "Before spending, your agent inspects what inputs the tool requires, what output structure it returns, and what pricing options apply.",
  },
  {
    title: "03 · Run & Return Verified Results",
    description:
      "FACET checks your local spending limit, signs payment on your device without exposing keys to the AI model, runs the tool, and returns structured results with proof links.",
  },
];

export const DOCS_CODE_SNIPPETS: DocsCodeSnippets = {
  installCli: `# Requires Node.js 22 or newer
npm install -g @facet-aex/cli
facet --help`,
  walletSetup: `# Create a new Avalanche wallet stored safely in macOS Keychain
facet wallet create
facet wallet status

# Or import an existing test wallet (key entered privately at the prompt)
facet wallet import`,
  discoverAndGrant: `# 1. Search available tools
facet search "gold" --type ACTOR

# 2. Check what inputs a tool needs and what it costs
facet inspect <provider>/<tool-name> --version <version>

# 3. Approve a spending cap (50000 = 0.05 fUSD per run, 500000 = 0.50 fUSD per day)
facet policy grant \\
  --facet <provider>/<tool-name> \\
  --version <version> \\
  --max-per-run 50000 \\
  --daily-cap 500000 \\
  --pricing-model PAY_PER_RUN`,
  managePolicies: `# Review your active spending approvals
facet policy show

# Turn off approval for one tool or revoke all tools right away
facet policy revoke --facet <provider>/<tool-name> --version <version>
facet policy revoke --all

# Clean up expired approvals
facet policy prune`,
  mcpInstall: `# Automatic setup for supported AI coding apps (safe backup, no keys saved)
facet mcp install antigravity
facet mcp install codex
facet mcp install claude

# Or print the JSON config to paste into Cursor or another AI app
facet mcp config antigravity`,
  mcpConfigJson: `{
  "mcpServers": {
    "facet": {
      "command": "npx",
      "args": ["-y", "@facet-aex/mcp-server"],
      "env": {
        "FACET_CONTROL_API_URL": "https://facet.briandev.space",
        "FACET_GATEWAY_URL": "https://facet.briandev.space"
      }
    }
  }
}`,
  spendHistory: `# View your recent payments, active holds, and automatic refunds
facet spend history

# Filter by status or date
facet spend history --status SETTLED --day 2026-11-20
facet spend history --status RELEASED --json`,
};
