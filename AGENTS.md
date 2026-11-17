# `web` instructions

**Owner in Wave 1:** Antigravity  
**Port:** `3000`  
**Active architectural authority:** `../docs/architecture/decisions/ADR-0015-actorbazaar-docker-and-a2a-mvp.md`

## Role

Next.js application delivering the **FACET Multi-Modal Catalogue**, **Minimalist Actor & A2A Agent Studio**, **Auto-Generated Input-Schema Form**, **Dataset Table Viewer**, and **On-Chain Proof / Receipt Explorer** on Avalanche Fuji.

## Core Views & Requirements

1. **Catalogue (`app/page.tsx`):**
   - Filterable by `All`, `Hosted Actors (Docker)`, `A2A Agents (ERC-8004)`, `External APIs`, and `Vietnamese Data`.
   - Displays badges for `HOSTED_ACTOR` (`imageDigest`), `AUTONOMOUS_AGENT` (`ERC-8004 #tokenId`), and `EXTERNAL_HTTP_API`, along with `x402` pricing (`0.001 fUSD`).
2. **Minimalist Provider Studio (`#provider-console`):**
   - **Tab 1 — Push Node.js Actor (1-Step):** Allows a provider to load a Vietnamese sample Actor template with 1 click or paste `export default async function run(input) { ... }`, define a minimal JSON Schema `inputSchema`, set `pricingModel` & `payTo`, and publish immediately via `POST /api/facet/actors`.
   - **Tab 2 — Register A2A Agent (ERC-8004):** Registers an autonomous agent bound to a Fuji ERC-8004 `tokenId` via `POST /api/facet/agent-facets`.
   - **Tab 3 — Import OpenAPI / REST Endpoint:** Existing OpenAPI & GET JSON flow.
3. **Facet Detail, Input-Schema Form & Dataset/Receipt Viewer (`app/facets/[facetId]/page.tsx`):**
   - Auto-generates an interactive **Input-Schema Form** from `facet.inputSchema` (plus Raw JSON toggle).
   - Executes paid runs over `x402` via a server-side BFF route (`POST /api/facet/invoke`) that signs/forwards to `gateway` so browser visitors and judges can test live paid execution in 1 click without exposing private keys to the client.
   - Renders the returned `dataset` in an Apify-style **Dataset Table Viewer** alongside JSON output, usage metrics (`itemCount`, `durationMs`), and **On-Chain Proof Links** (Snowtrace links for `payment.transaction`, `receipt.receiptTxHash`, `actorMeta.imageDigest`, and `agentMeta.erc8004TokenId`).

## Design & Accessibility

- Preserve the NUSX-inspired FACET visual system (`../docs/design/ui-brand-direction.md`): black field, warm white, electric-lime accent, Inter Tight + IBM Plex Mono, hard-edged technical grid, keyboard accessibility, and `prefers-reduced-motion` support.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
