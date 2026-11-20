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
  executionPath: string;
  trustAndAuthoring: string;
  pricingModels: string;
  studioHref: string;
  studioStatus: "Live" | "Coming Soon";
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

export interface McpToolCard {
  name: string;
  inputs: string;
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
    label: "Part 1 · Overview & Concepts",
    items: [
      { id: "overview", label: "01 · What is FACET" },
      { id: "facet-types", label: "02 · API, Actor & Agent" },
      { id: "core-definitions", label: "03 · Core Definitions" },
      { id: "pricing-escrow", label: "04 · Multi-Pricing & TaskEscrow" },
      { id: "contracts", label: "05 · Avalanche Contracts" },
    ],
  },
  {
    id: "part-agent-guide",
    label: "Part 2 · User & Agent Guide",
    items: [
      { id: "agent-guide", label: "06 · Buyer Safety Model" },
      { id: "install-cli", label: "07 · Install CLI" },
      { id: "wallet-faucet", label: "08 · Wallet & fUSD Faucet" },
      { id: "spend-policy", label: "09 · Spend Policy" },
      { id: "install-mcp", label: "10 · Install MCP Server" },
      { id: "agent-workflow", label: "11 · Agent Tools & Spend History" },
    ],
  },
];

export const MODALITY_MATRIX_ROWS: readonly ModalityMatrixRow[] = [
  {
    facetType: "API",
    label: "API",
    executionPath:
      "Full HTTP gateway (GET, POST, PUT, PATCH, DELETE; 2xx including 204) with write-only encrypted vault auth (NONE, BEARER, API_KEY_HEADER, API_KEY_QUERY, BASIC), static headers, all-IPs unicast SSRF blocking, DENY/SAME_ORIGIN redirect pinning, and optional datasetPath extraction.",
    trustAndAuthoring:
      "4-step /studio/api workbench with Live HTTP Check & Preview or OpenAPI 3.0/3.1 import; anchored on FacetActorRegistry (facetType = 0) with signed run receipts.",
    pricingModels: "PAY_PER_RUN or PAY_PER_RESULT (TaskEscrow via datasetPath)",
    studioHref: "/studio/api",
    studioStatus: "Live",
  },
  {
    facetType: "ACTOR",
    label: "Actor",
    executionPath:
      "Single-file ESM module (export default async function run(input)) executed inside an isolated facet/node-actor-runner:1.0 Node 22 Docker container (0.5 vCPU, 128 MB RAM, --read-only, --network=none) returning structured dataset[] rows.",
    trustAndAuthoring:
      "4-step /studio/actor workbench (single POST /v1/actors publish) with deterministic imageDigest anchored on FacetActorRegistry (facetType = 1) plus signed outputHash and itemCount.",
    pricingModels: "PAY_PER_RUN or PAY_PER_RESULT (TaskEscrow)",
    studioHref: "/studio/actor",
    studioStatus: "Live",
  },
  {
    facetType: "AGENT",
    label: "Agent",
    executionPath:
      "Autonomous multi-step task delegation returning structured answers alongside dataset citations and verifiable on-chain execution receipts.",
    trustAndAuthoring:
      "Bound to canonical ERC-8004 Identity & Reputation registries on Avalanche and FacetActorRegistry (facetType = 2). /studio/agent authoring is Coming Soon while published Agents run live in Store and MCP.",
    pricingModels: "PAY_PER_RUN or PAY_PER_RESULT (TaskEscrow)",
    studioHref: "/studio/agent",
    studioStatus: "Coming Soon",
  },
];

export const CORE_DEFINITIONS: readonly CoreDefinitionItem[] = [
  {
    term: "Facet & Natural Keys",
    badge: "FacetManifest v1",
    summary:
      "Every API, Actor, and Agent publishes an immutable SemVer release addressed externally as provider/facetName@version (8–16 char kebab-case provider, 4–32 char kebab-case facetName, plus human facetDisplayName). Internal database UUIDs never leak on public routes, CLI, or MCP.",
  },
  {
    term: "Provider vs Buyer / Agent",
    badge: "Single Account",
    summary:
      "A single Clerk account (with one unique kebab-case provider handle) identifies a human on FACET. Acting as a Provider is a role of that account when publishing Facets with a verified providerPayTo payout wallet; Buyers and AI Agents pay per execution under client-side spend caps.",
  },
  {
    term: "x402 v2 & Idempotency",
    badge: "402 -> 200",
    summary:
      "Unpaid requests return HTTP 402 with a PAYMENT-REQUIRED header quote. Clients retry with PAYMENT-SIGNATURE and the same Idempotency-Key bound to the caller, pinned provider/facetName@version, and canonical input. Reusing a key with different input returns 409 IDEMPOTENCY_CONFLICT; pending 202 runs replay safely without double-charging.",
  },
  {
    term: "fUSD on Avalanche & Faucet",
    badge: "EIP-3009 · 6 Decimals",
    summary:
      "Testnet settlement uses 6-decimal EIP-3009 fUSD on Avalanche (chain 43113 / eip155:43113). Wallets can claim 1 fUSD (1000000 atomic) every 24h per address (10 claims / 24h per IP) dispensed via standard ERC-20 transfer() from a pre-funded Avalanche faucet wallet.",
    href: "/faucet",
    linkLabel: "Open /faucet to claim test fUSD ↗",
  },
  {
    term: "Wallet-Signed Playground",
    badge: "Zero Demo Subsidy",
    summary:
      "Store detail pages run the interactive Wallet-Signed Playground: connect an EIP-1193 browser wallet on Avalanche chain 43113 and sign a gasless EIP-3009 fUSD authorization directly—with zero server-sponsored demo subsidy.",
  },
  {
    term: "On-Chain Registry & Receipts",
    badge: "Verifiable Provenance",
    summary:
      "FacetActorRegistry anchors facetType, imageDigest, schemaURI, pricing, and providerPayTo. After each execution, FacetReceiptLog records runId, facetId, inputHash, outputHash, itemCount, paymentTxHash, and runnerSignature.",
  },
  {
    term: "ERC-8004 Identity & Reputation",
    badge: "Avalanche Standard",
    summary:
      "Canonical ERC-8004 Identity and Reputation registries on Avalanche anchor portable Agent identity tokens and cumulative execution trust across independent client hosts.",
  },
];

export const AVALANCHE_CONTRACTS: readonly AvalancheContractRow[] = [
  {
    name: "FacetUSD (fUSD, EIP-3009)",
    address: FUJI_CONTRACTS.fusd,
    role: "6-decimal EIP-3009 settlement token used for x402 payments and pre-funded /faucet transfers on Avalanche (43113).",
  },
  {
    name: "FacetActorRegistry",
    address: FUJI_CONTRACTS.actorRegistry,
    role: "Anchors facetKey, facetType (0 = API, 1 = ACTOR, 2 = AGENT), imageDigest, schemaURI, primary pricing, providerPayTo, and ERC-8004 tokenId.",
  },
  {
    name: "FacetFeeSplitAndEscrow",
    address: FUJI_CONTRACTS.feeSplitAndEscrow,
    role: "Settles instant 95%/5% PAY_PER_RUN splits and manages PAY_PER_RESULT TaskEscrow deposits, claims, and automatic buyer refunds.",
  },
  {
    name: "FacetReceiptLog",
    address: FUJI_CONTRACTS.receiptLog,
    role: "Records immutable execution receipts (runId, facetId, inputHash, outputHash, itemCount, paymentTxHash, runnerSignature).",
  },
  {
    name: "ERC-8004 Identity Registry",
    address: ERC8004_IDENTITY_REGISTRY,
    role: "Canonical ERC-8004 Agent Identity Registry on Avalanche bound to published AGENT Facets.",
  },
  {
    name: "ERC-8004 Reputation Registry",
    address: ERC8004_REPUTATION_REGISTRY,
    role: "Canonical ERC-8004 Agent Reputation Registry on Avalanche.",
  },
];

export const BUYER_SAFETY_PILLARS: readonly BuyerSafetyPillar[] = [
  {
    title: "Local OS Keychain Wallet",
    badge: "macOS Keychain",
    summary:
      "Private keys are stored in protected OS credential storage (macOS Keychain via /usr/bin/security) and never appear in MCP config files, AI prompts, CLI flags, or logs.",
  },
  {
    title: "Default-Deny Spend Policy",
    badge: "Pinned SemVer",
    summary:
      "Every paid invocation is blocked by default until an operator explicitly grants a policy pinned to provider, facetName, exact SemVer version, providerPayTo, and on-chain verification.",
  },
  {
    title: "UTC Daily Cap & Spend Ledger",
    badge: "Auto-Release",
    summary:
      "Each run checks per-run and UTC daily limits in the local spend ledger before signing. Failed 502 runs and unused PAY_PER_RESULT TaskEscrow deposits release allowance automatically.",
  },
  {
    title: "Multi-Method Selection",
    badge: "pricingModel",
    summary:
      "When a Facet offers both PAY_PER_RUN and PAY_PER_RESULT, operators can pin --pricing-model in policy or let agents pass pricingModel to invoke_facet within approved caps.",
  },
];

export const MCP_TOOL_CARDS: readonly McpToolCard[] = [
  {
    name: "search_facets",
    inputs: "query, optional type (API | ACTOR | AGENT), category, limit",
    description:
      "Discovers published Facets across https://facet.briandev.space with live summaries, categories, and pricing models.",
  },
  {
    name: "get_facet",
    inputs: "provider, facetName, optional version",
    description:
      "Inspects the pinned inputSchema, outputSchema, pricingOptions[], apiMeta, actorMeta.imageDigest, or agentMeta.erc8004TokenId.",
  },
  {
    name: "invoke_facet",
    inputs:
      "provider, facetName, version, input, optional pricingModel, optional idempotencyKey",
    description:
      "Validates local spend policy, signs Avalanche fUSD x402 authorization locally without exposing keys, and returns result, dataset, usage, payment, and Snowtrace receipt links.",
  },
];

export const ACTOR_ESM_SNIPPET = `// main.mjs — executed inside isolated facet/node-actor-runner:1.0
export default async function run(input) {
  const brand = String(input?.brand ?? "ALL").toUpperCase();
  const rows = [
    { brand: "SJC", buyVnd: 88500000, sellVnd: 91000000 },
    { brand: "DOJI", buyVnd: 88600000, sellVnd: 90900000 },
  ];
  return brand === "ALL" ? rows : rows.filter((row) => row.brand === brand);
}`;

export const DOCS_CODE_SNIPPETS: DocsCodeSnippets = {
  installCli: `# Requires Node.js >= 22 (default target: https://facet.briandev.space)
npm install -g @facet-aex/cli
facet --help`,
  walletSetup: `# Provision a dedicated Avalanche wallet in macOS Keychain (key never printed)
facet wallet create
facet wallet status

# Or import an existing test key via hidden interactive prompt (CLI key flags are blocked)
facet wallet import

# Optional: isolate wallets, policies, and spend ledgers by profile
facet wallet status --profile staging`,
  discoverAndGrant: `# 1. Search published capabilities
facet search "gold" --type ACTOR

# 2. Inspect inputSchema, pricingOptions[], providerPayTo, and on-chain status
facet inspect <provider>/<facet-name> --version <semver>

# 3. Grant a bounded Default-Deny Spend Policy (1 fUSD = 1000000 atomic)
facet policy grant \\
  --facet <provider>/<facet-name> \\
  --version <semver> \\
  --max-per-run 50000 \\
  --daily-cap 500000 \\
  --pricing-model PAY_PER_RUN`,
  managePolicies: `# Inspect active policies for the selected profile
facet policy show

# Revoke a single Facet policy or revoke everything immediately
facet policy revoke --facet <provider>/<facet-name> --version <semver>
facet policy revoke --all

# Remove expired policies
facet policy prune`,
  mcpInstall: `# Direct installers (write safe backup; zero private keys stored)
facet mcp install antigravity
facet mcp install codex
facet mcp install claude

# Cursor or other MCP hosts: print standard mcpServers JSON
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
  spendHistory: `# Audit local reservations, settlements, and TaskEscrow refunds
facet spend history

# Filter by status or UTC day (YYYY-MM-DD), or emit JSON
facet spend history --status SETTLED --day 2026-11-20
facet spend history --status RELEASED --json`,
};
