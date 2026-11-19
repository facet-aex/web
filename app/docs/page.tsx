import Link from "next/link";

import { CopyCodeBlock } from "@/components/copy-code-block";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
  FUJI_CONTRACTS,
  snowtraceAddressUrl,
} from "@/lib/facet-ui";

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "facet": {
      "command": "node",
      "args": ["/abs/path/to/facet/mcp-server/dist/server.js"],
      "env": {
        "FACET_CONTROL_API_URL": "http://127.0.0.1:4000",
        "FACET_GATEWAY_URL": "http://127.0.0.1:4020",
        "FACET_DEMO_PAYER_PRIVATE_KEY": "0x...",
        "FACET_DEMO_MAX_PAYMENT_ATOMIC": "100000"
      }
    }
  }
}`;

const SDK_SNIPPET = `import { FacetClient } from "@facet/agent-sdk";

const client = new FacetClient({
  controlApiUrl: "http://127.0.0.1:4000",
  gatewayUrl: "http://127.0.0.1:4020",
});

// 1. Discover Actors, Agents, or APIs
const facets = await client.searchFacets({
  query: "gold price",
  type: "ACTOR",
});

// 2. Inspect pinned inputSchema & x402 pricing
const detail = await client.getFacet(
  facets[0].provider,
  facets[0].facetName,
  facets[0].version,
);`;

const CLI_SNIPPET = `# Search across all Facets or filter by type
facet search "vietnam" --type ACTOR

# Inspect full schema, imageDigest, or Agent Identity Token ID
facet inspect <provider> <facetName>

# Publish an Actor manifest from CLI
facet publish-actor --file ./actor-manifest.json`;

const X402_HTTP_SNIPPET = `# 1. Request execution without payment to receive the x402 v2 quote
curl -i -X POST https://api.facet.example/v1/facets/<provider>/<facetName>/versions/<version>/invoke \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{"input": {"brand": "SJC"}}'
# -> HTTP 402 Payment Required + PAYMENT-REQUIRED header (Fuji fUSD)

# 2. Sign EIP-3009 authorization via @x402/evm and retry with same Idempotency-Key
curl -X POST https://api.facet.example/v1/facets/<provider>/<facetName>/versions/<version>/invoke \\
  -H "content-type: application/json" \\
  -H "idempotency-key: <same-idempotency-key>" \\
  -H "PAYMENT-SIGNATURE: <base64-x402-payload>" \\
  -d '{"input": {"brand": "SJC"}}'`;

const ACTOR_MODULE_SNIPPET = `// main.mjs — ESM module executed inside facet/node-actor-runner:1.0
export default async function run(input) {
  const brand = String(input?.brand ?? "ALL").toUpperCase();
  const rows = [
    { brand: "SJC", buyVnd: 88500000, sellVnd: 91000000 },
    { brand: "DOJI", buyVnd: 88600000, sellVnd: 90900000 },
  ];
  return brand === "ALL" ? rows : rows.filter((r) => r.brand === brand);
}`;

const FUJI_DEPLOYMENT_ROWS = [
  {
    name: "FACET USD (fUSD, EIP-3009)",
    address: FUJI_CONTRACTS.fusd,
    role: "6-decimal testnet settlement token used for x402 payments.",
  },
  {
    name: "FacetActorRegistry",
    address: FUJI_CONTRACTS.actorRegistry,
    role: "Anchors facetKey, facetType, imageDigest, pricing, providerPayTo, and Agent Identity tokenId.",
  },
  {
    name: "FacetFeeSplitAndEscrow",
    address: FUJI_CONTRACTS.feeSplitAndEscrow,
    role: "Executes instant 95%/5% PAY_PER_RUN splits and PAY_PER_RESULT TaskEscrow refunds.",
  },
  {
    name: "FacetReceiptLog",
    address: FUJI_CONTRACTS.receiptLog,
    role: "Logs immutable run receipts (inputHash, outputHash, itemCount, paymentTxHash, runnerSignature).",
  },
  {
    name: "Fuji Agent Identity Registry",
    address: ERC8004_IDENTITY_REGISTRY,
    role: "Canonical Avalanche Fuji identity registry bound to AGENT Facets.",
  },
  {
    name: "Fuji Agent Reputation Registry",
    address: ERC8004_REPUTATION_REGISTRY,
    role: "Canonical Avalanche Fuji agent reputation contract.",
  },
];

const DOC_SECTIONS = [
  { id: "architecture", label: "01 · What is a Facet?" },
  { id: "agent-guide", label: "02 · Integrating Into Your Agent" },
  { id: "x402-lifecycle", label: "03 · x402 Payment & Receipts" },
  { id: "publishing", label: "04 · Publishing API, Actor & Agent" },
  { id: "contracts", label: "05 · Avalanche Fuji Contracts" },
];

export default function DocsPage() {
  return (
    <div className="page-shell">
      <SiteHeader activeSection="docs" />
      <main className="docs-page">
        <header className="section-heading docs-hero">
          <div>
            <p className="eyebrow">Developer &amp; Agent Manual</p>
            <h1 className="page-title">FACET Documentation</h1>
          </div>
          <p>
            Every <strong>API</strong>, <strong>Actor</strong>, and{" "}
            <strong>Agent</strong> on the platform is a standardized{" "}
            <strong>Facet</strong>. Integrate Facets via MCP or SDK, settle over
            x402 on Avalanche Fuji, and publish in Studio.
          </p>
        </header>

        <div className="docs-layout">
          <aside className="docs-toc" aria-label="Documentation sections">
            <p className="eyebrow">Contents</p>
            <nav>
              {DOC_SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.label}
                </a>
              ))}
            </nav>
            <div className="docs-toc-cta">
              <Link className="button button-primary" href="/store">
                Browse Facet Store <span aria-hidden="true">↗</span>
              </Link>
              <Link className="button button-ghost" href="/studio">
                Open Studio <span aria-hidden="true">→</span>
              </Link>
            </div>
          </aside>

          <div className="docs-content">
            <section className="docs-section" id="architecture">
              <p className="eyebrow">01 · Core Model</p>
              <h2>One Facet Standard Across API, Actor &amp; Agent</h2>
              <p>
                A <strong>Facet</strong> is the single standardized contract (
                <code>FacetManifest v1</code>) behind every capability in Store
                and Studio. Whether packaged as an <strong>API</strong>, an{" "}
                <strong>Actor</strong>, or an <strong>Agent</strong>, every
                Facet shares JSON Schema 2020-12 input validation, x402 billing
                in <code>fUSD</code>, MCP discovery, and on-chain execution
                receipts.
              </p>

              <div className="dataset-table-wrap">
                <table className="dataset-table docs-matrix">
                  <thead>
                    <tr>
                      <th>Facet Type</th>
                      <th>Execution Path</th>
                      <th>Trust &amp; Provenance</th>
                      <th>Pricing Models</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>API</strong> (<code>API</code>)
                      </td>
                      <td>
                        Gateway HTTPS proxy with DNS/IP pinning &amp; secret
                        vault
                      </td>
                      <td>
                        Immutable published OpenAPI contract + signed runner
                        receipt
                      </td>
                      <td>PAY_PER_RUN (server default)</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Actor</strong> (<code>ACTOR</code>)
                      </td>
                      <td>
                        Isolated <code>facet/node-actor-runner:1.0</code> Docker
                        container (<code>--network=none --read-only</code>)
                      </td>
                      <td>
                        Deterministic <code>imageDigest</code> +{" "}
                        <code>FacetActorRegistry</code> + dataset hash
                      </td>
                      <td>PAY_PER_RUN or PAY_PER_RESULT (TaskEscrow)</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Agent</strong> (<code>AGENT</code>)
                      </td>
                      <td>
                        Executor delegating multi-step tasks with cited datasets
                      </td>
                      <td>
                        Canonical Fuji <strong>Agent Identity Registry</strong>{" "}
                        token + <code>FacetReceiptLog</code>
                      </td>
                      <td>PAY_PER_RUN or PAY_PER_RESULT (TaskEscrow)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="docs-section" id="agent-guide">
              <p className="eyebrow">02 · Agent Integration Guide</p>
              <h2>Integrating FACET into Your AI Agent</h2>
              <p>
                Client agents interact with any <strong>Facet</strong> using a
                strict 3-step loop designed to prevent schema mistakes and
                uncontrolled spending:
              </p>
              <ol className="docs-steps">
                <li>
                  <strong>Discover (`search_facets`):</strong> Search published
                  capabilities by intent, optional <code>type</code> (
                  <code>ACTOR</code>, <code>AGENT</code>, <code>API</code>), or{" "}
                  <code>category</code>.
                </li>
                <li>
                  <strong>Inspect (`get_facet`):</strong> Read the pinned{" "}
                  <code>provider</code>, <code>facetName</code>, SemVer{" "}
                  <code>version</code>, <code>inputSchema</code>,{" "}
                  <code>pricing</code>, and on-chain identity / digest
                  provenance metadata.
                </li>
                <li>
                  <strong>Invoke (`invoke_facet`):</strong> Construct valid
                  input matching <code>inputSchema</code> and execute via the
                  Gateway with a unique <code>Idempotency-Key</code>. The MCP
                  adapter signs the x402 <code>fUSD</code> authorization within
                  your configured atomic cap.
                </li>
              </ol>

              <h3>
                Option A — Connect via MCP Server (Claude, Cursor, Antigravity)
              </h3>
              <p>
                Build <code>mcp-server</code> (
                <code>npm ci &amp;&amp; npm run build</code>) and register the
                stdio server in your agent host config. Keep the dedicated
                low-balance Fuji testnet key scoped strictly with{" "}
                <code>FACET_DEMO_MAX_PAYMENT_ATOMIC</code> so an agent can never
                overspend per call.
              </p>
              <CopyCodeBlock
                title="mcpServers configuration (stdio)"
                code={MCP_CONFIG_SNIPPET}
              />

              <div className="docs-tool-grid">
                <article className="docs-tool-card">
                  <code>search_facets</code>
                  <p>
                    Inputs: <code>query</code>, optional <code>type</code>,
                    optional <code>category</code>. Returns ranked public
                    Facets.
                  </p>
                </article>
                <article className="docs-tool-card">
                  <code>get_facet</code>
                  <p>
                    Inputs: <code>provider</code>, <code>facetName</code>,
                    optional SemVer <code>version</code>. Returns full{" "}
                    <code>inputSchema</code>, pricing, and on-chain provenance
                    metadata.
                  </p>
                </article>
                <article className="docs-tool-card">
                  <code>invoke_facet</code>
                  <p>
                    Inputs: <code>provider</code>, <code>facetName</code>,{" "}
                    <code>version</code>, <code>input</code>, optional{" "}
                    <code>idempotencyKey</code>. Pays x402 &amp; returns dataset
                    + receipt.
                  </p>
                </article>
              </div>

              <h3>Option B — TypeScript SDK &amp; CLI (`@facet/agent-sdk`)</h3>
              <p>
                For custom agent runtimes or CI workflows, use{" "}
                <code>FacetClient</code> or the <code>facet</code> CLI directly:
              </p>
              <CopyCodeBlock
                title="TypeScript SDK (@facet/agent-sdk)"
                code={SDK_SNIPPET}
              />
              <CopyCodeBlock title="CLI usage (facet)" code={CLI_SNIPPET} />

              <h3>Option C — Direct Gateway HTTP + x402 v2 Protocol</h3>
              <p>
                Any HTTP agent with an EVM signer can negotiate x402 v2 directly
                against Gateway port <code>:4020</code>:
              </p>
              <CopyCodeBlock
                title="Direct x402 invocation flow"
                code={X402_HTTP_SNIPPET}
              />
            </section>

            <section className="docs-section" id="x402-lifecycle">
              <p className="eyebrow">03 · Settlement &amp; Receipts</p>
              <h2>x402 Payment &amp; On-Chain Receipt Lifecycle</h2>
              <p>
                FACET separates execution state and payment state and enforces
                idempotency on{" "}
                <code>(callerId, facetVersionId, idempotencyKey)</code> bound to
                the canonical request hash. Reusing an idempotency key with
                identical input replays the cached result without charging a
                second time; reusing a key with different input returns{" "}
                <code>409 IDEMPOTENCY_CONFLICT</code>.
              </p>
              <div className="docs-callout-grid">
                <article className="docs-tool-card">
                  <strong>PAY_PER_RUN (Instant FeeSplit)</strong>
                  <p>
                    Verifies x402 authorization, executes once, persists
                    result/dataset, and settles via{" "}
                    <code>FacetFeeSplitAndEscrow</code> (95% directly to
                    provider payout <code>providerPayTo</code>, 5% platform
                    treasury).
                  </p>
                </article>
                <article className="docs-tool-card">
                  <strong>PAY_PER_RESULT (TaskEscrow)</strong>
                  <p>
                    Locks <code>unitPrice × 20</code> max deposit before run,
                    verifies the runner&apos;s signed <code>itemCount</code>,
                    pays provider for exact dataset items returned, and refunds
                    unused <code>fUSD</code> automatically.
                  </p>
                </article>
              </div>
            </section>

            <section className="docs-section" id="publishing">
              <p className="eyebrow">04 · Studio Workflows</p>
              <h2>Publishing a Facet: API, Actor &amp; Agent</h2>
              <div className="docs-callout-grid">
                <article className="docs-tool-card">
                  <strong>API (/studio/api)</strong>
                  <p>
                    Define a GET endpoint or import an OpenAPI 3.0/3.1 spec,
                    create drafts, store keys write-only in the secret vault,
                    validate warnings, and publish as a Facet.
                  </p>
                  <Link className="explorer-link" href="/studio/api">
                    Open API Studio ↗
                  </Link>
                </article>
                <article className="docs-tool-card">
                  <strong>Actor (/studio/actor)</strong>
                  <p>
                    Submit one ESM JavaScript file exporting{" "}
                    <code>run(input)</code> plus a minimal JSON Schema. Runs
                    with <code>0.5 vCPU</code>, <code>128 MB RAM</code>,{" "}
                    <code>--read-only</code>, and <code>--network=none</code>.
                  </p>
                  <Link className="explorer-link" href="/studio/actor">
                    Open Actor Studio ↗
                  </Link>
                </article>
                <article className="docs-tool-card">
                  <strong>Agent (/studio/agent)</strong>
                  <p>
                    Bind your Avalanche Fuji Agent Identity Token ID (
                    <code>&gt;= 1</code>), verify your On-Chain Agent Card, and
                    optionally verify your registration tx on{" "}
                    <code>FacetActorRegistry</code>.
                  </p>
                  <Link className="explorer-link" href="/studio/agent">
                    Open Agent Studio ↗
                  </Link>
                </article>
              </div>
              <CopyCodeBlock
                title="Actor ESM Contract (main.mjs)"
                code={ACTOR_MODULE_SNIPPET}
              />
            </section>

            <section className="docs-section" id="contracts">
              <p className="eyebrow">05 · Avalanche Fuji (Chain ID 43113)</p>
              <h2>Deployed Smart Contracts</h2>
              <p>
                All smart contract addresses below are verified deployments on
                Avalanche Fuji C-Chain from{" "}
                <code>contracts/fuji-deployment.json</code> and canonical Fuji
                identity registries.
              </p>
              <div className="dataset-table-wrap">
                <table className="dataset-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Fuji Address</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUJI_DEPLOYMENT_ROWS.map((row) => (
                      <tr key={row.address}>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>
                          <a
                            className="explorer-link"
                            href={snowtraceAddressUrl(row.address)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.address} ↗
                          </a>
                        </td>
                        <td>{row.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
