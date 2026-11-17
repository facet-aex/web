# FACET Web Multi-Page & Studio Redesign

**Status:** Draft for approval  
**Date:** 2026-11-17  
**Scope:** Frontend UI/UX overhaul inside `web/` only (zero backend, database, gateway, or API contract changes)

---

## 1. Intent & Constraints

### Intent
Transform `web` from a single monolithic scroll page (`app/page.tsx`) into a clean multi-page product experience with clear separation between marketing, capability discovery, capability creation, and developer documentation, while preserving FACET's existing dark/lime visual brand (`#050505` / `#0d0d0d` / `#dfff4f`, `Inter Tight` + `IBM Plex Mono`, 1px technical grid).

### Goals
1. **Multi-page routing:**
   - `/` — Dedicated **Landing Page** introducing FACET with clear CTAs into Store, Studio, and Docs (removing inline catalog & creation forms from `/`).
   - `/store` — Dedicated **Facet Store** with unmistakable visual and metadata differentiation across `HTTP API`, `Hosted Actor`, and `A2A Agent`.
   - `/facets/[facetId]` — Enhanced **Facet Detail & Playground** with type-specific header cards (including the On-Chain Agent Card for `AUTONOMOUS_AGENT`).
   - `/studio` — **Provider Studio Hub** with shared Provider Workspace selector/creator and dedicated sub-routes:
     - `/studio/api` — **RapidAPI-inspired API Provider Hub**
     - `/studio/actor` — **Apify-inspired Hosted Actor Studio**
     - `/studio/agent` — **ERC-8004 Autonomous Agent Studio** with a live **On-Chain Agent Card**
   - `/docs` — **Developer & Agent Documentation** covering the 3 Facet types, x402 payment/receipt lifecycle, MCP server tools, `@facet/agent-sdk`, and Avalanche Fuji contract addresses.
2. **Crystal-clear type differentiation:** In both `/store` and `/studio`, users always know whether they are interacting with an **HTTP API** (`EXTERNAL_HTTP_API`), **Hosted Actor** (`HOSTED_ACTOR`), or **Autonomous Agent** (`AUTONOMOUS_AGENT`).
3. **English UI copy:** Standardize all interface chrome, labels, errors, and docs in English while preserving existing Vietnamese sample templates (`vn-gold-fx-actor`, `vn-tech-news-actor`, `vn-market-analyst-agent`) as preset payloads.

### Non-Goals & Hard Constraints
- **No backend or BFF contract changes:** Keep all `/api/facet/*` handlers, `control-api` endpoints (`/v1/actors`, `/v1/agent-facets`, `/v1/openapi-imports`, `/v1/facets`, `/v1/facet-versions/:id/*`, `/v1/catalog/facets`), and `gateway` `/v1/facet-versions/:id/invoke` untouched.
- **No fabricated capabilities or pricing:** `EXTERNAL_HTTP_API` uses the existing multi-step OpenAPI import → draft → endpoint-config/secrets → validate → publish pipeline with server-default pricing; `makeManualOpenApi` supports single `GET` endpoints cleanly without claiming unimplemented HTTP methods in the Quick Endpoint builder. `HOSTED_ACTOR` executes in `facet/node-actor-runner:1.0` with `--network=none --cpus=0.5 --memory=128m --pids-limit=32 --read-only`. `AUTONOMOUS_AGENT` reflects actual `gateway`/`executor` constraints (canonical Fuji ERC-8004 registry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, positive integer `erc8004TokenId >= 1`, no unused custom `code` input, and explicit compatibility indicator for `taskKind: "vn-market-analysis"`).
- **Preserve brand & accessibility:** Keep `docs/design/ui-brand-direction.md` tokens, Clerk authentication (`ClerkAuthBar`, `/sign-in`, `/sign-up`, `proxy.ts` unchanged so `/studio/**` stays browsable while `ProviderSelectorBar` renders an inline Clerk sign-in CTA on `401`), keyboard accessibility, status text+indicator pairing, and `prefers-reduced-motion`.

---

## 2. Approaches Considered

1. **Approach A — Dedicated Studio Sub-Routes (`/studio` + `/studio/api`, `/studio/actor`, `/studio/agent`) [Selected]:**
   - `/studio` acts as a hub for Provider profile selection/creation and choosing a Facet modality; each modality opens a full-width, purpose-built workspace (`/studio/api`, `/studio/actor`, `/studio/agent`) with shared Studio sub-navigation.
   - *Pros:* Bookmarkable URLs for Landing CTAs, ample horizontal space for RapidAPI 2-pane endpoints and Apify Schema Builder + Code Editor without cramping, clean isolation of complex client state.
   - *Cons:* Slightly more route files (`app/studio/**/page.tsx`).
2. **Approach B — Single `/studio` Route with Client Tabs:**
   - Keeps one `/studio` route switching forms via React state.
   - *Why rejected:* Prevents direct deep-linking from Landing/Store CTAs to a specific modality and mixes complex RapidAPI/Apify/Agent state inside one component tree.

---

## 3. Route & Component Architecture

### 3.1 Shared App Shell
- **`components/site-header.tsx` (Client wrapper + Server-friendly active path):**
  - Sticky top header with FACET mark (`public/facet-logo.svg`) linking to `/` (home navigation via logo only — no separate `Home` button in the nav bar).
  - Primary navigation (`next/link`): `Store` (`/store`, active on `/store` and `/facets/**`), `Studio` (`/studio`, active on `/studio/**`), `Docs` (`/docs`).
  - Right slot: `<Suspense><ClerkAuthBar /></Suspense>`.
  - Mobile navigation strip (`max-width: 900px`): horizontal scrollable/grid nav strip directly below header top row so all 3 top-level routes remain reachable on small screens (replacing the current `display: none` mobile nav rule).
- **`components/site-footer.tsx`:**
  - Consistent footer across pages with brand tagline and quick links (`/store`, `/studio`, `/docs`).
- **Auth pages (`app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`):**
  - Update navigation link from `← Facet Store` (`/`) to `← Back to Home` (`/`) and `Store` (`/store`).

### 3.2 Landing Page (`/`) — `app/page.tsx`
Pure marketing & onboarding entry page:
1. **Hero Section:**
   - Eyebrow: `FEDERATED AGENT CAPABILITY EXCHANGE & TRUST — AVALANCHE FUJI`
   - Display headline: `Find the missing capability.`
   - Concise description of the 3 executable modalities settled via x402 (`fUSD`) with on-chain receipts.
   - Primary CTAs: `Explore Facet Store` (`/store`), `Open Provider Studio` (`/studio`), `Read Docs` (`/docs`).
2. **Three Facet Modalities Grid (Side-by-Side):**
   - **01 · External HTTP API (`EXTERNAL_HTTP_API`)**: RapidAPI-style REST onboarding via OpenAPI or single endpoint, gateway SSRF pinning & encrypted secret vault. CTAs: `Browse APIs` (`/store?type=EXTERNAL_HTTP_API`), `Publish API` (`/studio/api`).
   - **02 · Hosted Actor (`HOSTED_ACTOR`)**: Apify-style single-ESM-file Node.js sandbox (`facet/node-actor-runner:1.0`), structured Dataset outputs, deterministic `imageDigest` anchored on-chain. CTAs: `Browse Actors` (`/store?type=HOSTED_ACTOR`), `Build Actor` (`/studio/actor`).
   - **03 · Autonomous Agent (`AUTONOMOUS_AGENT`)**: ERC-8004 on-chain identity bound A2A agents on Fuji, structured report + dataset citation outputs, instant x402 settlement. CTAs: `Browse Agents` (`/store?type=AUTONOMOUS_AGENT`), `Register Agent` (`/studio/agent`).
3. **4-Step Trust & Settlement Strip (`01 Discover → 02 Verify → 03 Execute → 04 Settle`)**:
   - Explains MCP tools (`search_facets`, `get_facet`, `invoke_facet`), `x402` challenge/settlement (`FacetFeeSplitAndEscrow`), and `FacetReceiptLog` provenance.

### 3.3 Facet Store (`/store`) & Detail (`/facets/[facetId]`)
- **`app/store/page.tsx`:**
  - Server Component reading `searchParams` (`q`, `type`, `category`) and calling `getPublicFacets()`.
  - **Type Selector Bar:** Interactive filter tabs (`All Capabilities`, `HTTP APIs`, `Hosted Actors`, `A2A Agents`) plus `Vietnamese Data` category pill, showing clear count of displayed matches and active type description banner so buyers immediately recognize the modality they are browsing.
  - **Search Form:** Submits GET query to `/store` preserving `type` / `category` filters.
  - **Updated `components/facet-row.tsx`:**
    - Visually distinct modality header per type (type glyph + distinct badge styling + human-readable type label: `HTTP API`, `HOSTED ACTOR`, `A2A AGENT`), plus modality-specific provenance strip:
      - `EXTERNAL_HTTP_API`: HTTP method pill (`GET`/`POST`), Gateway proxy tag, x402 price, CTA `Open Playground ↗`.
      - `HOSTED_ACTOR`: `nodejs22-alpine-v1` runtime tag, truncated `imageDigest` + registry check (`Verified ✓` / `Unverified`), Dataset badge, x402 price (`fUSD / run` or `fUSD / item`), CTA `Run Actor ↗`.
      - `AUTONOMOUS_AGENT`: Highlighted **ERC-8004 Identity chip** (`ERC-8004 #<tokenId>`), `taskKind` badge, registry verification status, x402 price, CTA `Delegate Task ↗`.
- **`app/facets/[facetId]/page.tsx`:**
  - Includes `SiteHeader` and `SiteFooter`, breadcrumb `Store / <Modality> / <Facet Name>`.
  - When `facetType === "AUTONOMOUS_AGENT"` (and `agentMeta` present), displays a compact **`AgentIdentityCard`** summarizing ERC-8004 chain (`43113`), registry Snowtrace link, Token ID, `taskKind`, `payTo` wallet, and registry verification state.
  - Updates `<FacetPlayground facet={facet} />` to also initialize and edit `type: "array"` fields cleanly via a JSON array editor (supporting seeded Actors/Agents such as `goldQuotes`/`articles` alongside flat schemas), keeping Input/Output Schema pair and Dataset Table Viewer + Fuji On-Chain Proof/Receipt panel.

### 3.4 Shared Studio Shell & Provider Workspace (`/studio`)
- **`components/studio-shell.tsx`:**
  - Persistent top Studio bar with 4 navigation links (`Overview` `/studio`, `Publish HTTP API` `/studio/api`, `Build Hosted Actor` `/studio/actor`, `Register A2A Agent` `/studio/agent`), active-route highlight, and modality indicator badge.
- **`components/provider-selector-bar.tsx`:**
  - Shared client bar + `useProviderWorkspace()` hook used across `/studio`, `/studio/api`, `/studio/actor`, and `/studio/agent`:
    - Loads `GET /api/facet/providers` memberships and persists active `providerId` across Studio sub-routes in `sessionStorage` (`facet:selectedProviderId`).
    - When `GET /api/facet/providers` returns `401 AUTHENTICATION_REQUIRED` (signed-out Clerk session), displays a clear inline Clerk sign-in CTA (`SignInButton` modal or `/sign-in` link) instead of a generic error while keeping the Studio workspace viewable.
    - Displays active Provider dropdown (`<name> / <role>`) and an inline `+ New Provider` toggle drawer (`POST /api/facet/providers` with auto-generated slug from name, editable slug, optional `walletAddress`, and clear error feedback).
    - Removes the buried provider-creation form from inside the OpenAPI importer so Actor and Agent creators can onboard a Provider directly.
- **`app/studio/page.tsx` (Studio Overview):**
  - Displays the Provider bar + 3 modality creation cards comparing workflow steps, outputs, pricing options, and direct CTA buttons into `/studio/api`, `/studio/actor`, and `/studio/agent`.

### 3.5 Apify-Inspired Actor Studio (`/studio/actor`)
- **`lib/input-schema-builder.ts` + `components/input-schema-builder.tsx`:**
  - Reusable visual JSON Schema 2020-12 builder (shared by Actor Studio and Agent Studio):
    - Supports three views: **Visual Builder** | **Raw JSON** | **Form Preview**.
    - Visual rows manage top-level `properties`: `name`, `type` (`string` | `integer` | `number` | `boolean` | `array`), `required` toggle, `default`, comma-separated `enum` options, and `description`.
    - Pure helper functions convert simple flat object schemas <-> visual field rows deterministically, and detect non-flat/advanced constructs (`anyOf`, `oneOf`, nested `object` properties) so users are automatically kept safe in Raw JSON mode with a clear info banner (never silently discarding schema keywords).
    - Live **Form Preview** renders the exact field preview matching `FacetPlayground` (including `array` JSON editor).
- **`components/actor-studio.tsx` (rendered by `app/studio/actor/page.tsx`):**
  - **Top Action Strip:** Modality badge (`HOSTED ACTOR · DOCKER SANDBOX`), Template Preset switcher (`Blank ESM Actor`, `VN Gold & FX Scraper`, `VN Tech & Macro News Extractor` from `lib/actor-templates.ts`), and primary `Publish Actor` submit action (`POST /api/facet/actors`).
  - **2-Column Apify-style Workspace:**
    - **Left Main Pane with Apify-style Editor Tabs:**
      1. `Source & Metadata`: Name, auto-synced Slug (with manual edit lock once customized), Category, Tags, Summary/Description, and a line-numbered ESM Code Editor (`main.mjs` — `export default async function run(input) { ... }`) with validation hint.
      2. `Input Schema`: Embedded `<InputSchemaBuilder />` (Visual Builder / Raw JSON / Live Form Preview).
      3. `Pricing & Payout`: `PAY_PER_RUN` (Instant FeeSplit) vs `PAY_PER_RESULT` (TaskEscrow per dataset item) cards, `priceAtomic` input (`>= 1`) with live `fUSD` conversion (`1000` = `0.001 fUSD`), optional `payTo` EVM address, and optional pre-existing `registryTxHash` + `id` fields in an expandable Advanced On-Chain section.
    - **Right Sticky Inspector (`Actor Build & Runtime Spec`):**
      - Container Runtime Card: `facet/node-actor-runner:1.0` (`nodejs22-alpine-v1`), `0.5 vCPU`, `128 MB RAM`, `32 PIDs`, `--read-only`, `--network=none`.
      - Live Manifest Summary: slug, pricing summary, schema field count, and client-side readiness checklist (provider selected, valid JSON schema, exported `run` function).
      - Post-Publish Success Panel: Shows returned `facet.id`, deterministic `imageDigest`, direct `Open & Run in Playground ↗` link (`/facets/[id]`), and an inline **Verify on Fuji FacetActorRegistry** input (`POST /api/facet/facets/[facetId]/verify-registry`) to anchor/verify an on-chain registration tx hash right after publishing.

### 3.6 RapidAPI-Inspired API Provider Hub (`/studio/api`)
- **`components/api-studio.tsx` (rendered by `app/studio/api/page.tsx`, replacing inline provider creation inside `ProviderImportWorkspace`) + upgraded `FacetDraftWorkbench`:**
  - **4-Stage RapidAPI Progress Header:** `01 Define or Import` → `02 Select Operations` → `03 Configure Gateway & Auth` → `04 Validate & Publish`.
  - **Phase 1 — Source Definition (Clean RapidAPI Entry):**
    - Two clear mode tabs:
      1. **Quick Endpoint (GET JSON):** RapidAPI-style form with API Name, Method badge (`GET`, matching `makeManualOpenApi`), HTTPS Endpoint URL (detects `{pathParam}` placeholders automatically and displays detected path parameter chips), interactive **Query Parameters list** (add/remove param name rows instead of raw comma string; joins cleanly for `makeManualOpenApi`), Optional API Key Header name, and Description ("What can an agent do with this API?"). Submitting generates OpenAPI 3.1 via `makeManualOpenApi` and immediately runs the import job (`POST /api/facet/openapi-imports` + poll).
      2. **Import OpenAPI 3.0 / 3.1 Spec:** Clean `HTTPS URL` | `Paste JSON/YAML` | `Upload File` (<= 5 MiB JSON-content fallback, preserving accurate upload & isolated HTTPS fetch descriptions per `ui-brand-direction.md`) radio tabs, API description name, and `Import OpenAPI` submit button.
    - Right-hand **Import Job Monitor**: Live job status badge (`idle` / `submitting` / `polling` / `ready` / `failed`), job ID, parsed warnings list, and discovered operation checkboxes + `Create Drafts (<N> selected)` trigger.
  - **Phase 2 & 3 — RapidAPI 2-Pane Definition & Publishing Workbench (`components/facet-draft-workbench.tsx`):**
    - Replaces the stacked vertical cards with a **2-Pane RapidAPI Hub** over the selected operation candidates:
      - **Left Sidebar (`Endpoints`)**:
        - Before drafts created: displays selected operations and allows clicking any operation to inspect/edit its `General & Catalog` fields before submitting the batch `Create Facet drafts` action (`POST /api/facet/facets`, after which operation selection locks).
        - After drafts created: acts as the clickable **Endpoint Selector**, showing HTTP method pill, path, and lifecycle stage pill (`DRAFT` → `CONFIGURED` → `VALID` → `PUBLISHED`) for each operation.
      - **Right Pane (`Selected Endpoint Inspector`)** with 3 focused sub-tabs:
        1. `General & Catalog`: Facet Name, Slug, Category, Agent Usage Description, Search Tags, Side-Effect Class (`READ_ONLY`, etc.) — editable pre-draft, read-only summary post-draft (matching `control-api`).
        2. `Gateway & Auth` (unlocked post-draft): Upstream HTTPS Base URL, Upstream Auth selector (`NONE`, `API_KEY_HEADER`, `API_KEY_QUERY`, `BEARER`), Parameter Name, Secret Vault Label & write-only Masked Secret Value (never displayed after submission), warning notice when manual auth review is needed, and `Save Endpoint Config` (`POST /secrets` + `PUT /endpoint-config`).
        3. `Validate & Publish` (unlocked post-configure/valid): Runs `POST /validate`, renders errors/warnings clearly with `Acknowledge Warnings & Validate` if needed, lets provider pick `PUBLIC` / `UNLISTED` visibility, calls `POST /publish`, and displays `Published v<displayVersion>` + direct `Open in Store ↗` link (`/facets/[facetId]`).
    - All existing helper functions (`buildDraftSelections`, `suggestEndpoint`, `requiresManualAuthReview`, `readFacetDraftsResponse`, `readFacetValidationResponse`, `readFacetPublicationResponse`, `pollImportJob`) remain intact so existing unit tests stay green.

### 3.7 ERC-8004 Agent Studio & On-Chain Agent Card (`/studio/agent`)
- **`components/agent-identity-card.tsx`:**
  - Reusable visual **On-Chain Agent Card** component used both as a live sticky preview in `/studio/agent` and on `/facets/[facetId]` for published `AUTONOMOUS_AGENT` facets.
  - Displays:
    - Header strip: `ERC-8004 A2A IDENTITY` badge, Chain badge `AVALANCHE FUJI (43113)`, Verification status pill (`Verified on Fuji ✓` | `Tx Pending Verification` | `Draft Preview`), and Runner compatibility badge (`Executable on Fuji A2A Runner ✓` when `taskKind === "vn-market-analysis"` vs `Registry Metadata Only`).
    - Identity block: Agent monogram badge, Name, `@slug`, `taskKind` badge, and short summary.
    - **On-Chain Credential Table:**
      - `ERC-8004 Registry`: `0x8004A818BFB912233c491871b3d84c89A494BD9e` (Snowtrace address link)
      - `Identity Token ID`: `#<erc8004TokenId>`
      - `Agent Wallet (payTo)`: address or default provider indicator
      - `x402 Settlement`: `<price> fUSD / <run|item>` (`fUSD` asset)
      - `A2A Protocol`: `A2A v1.0 · MCP Compatible`
      - Optional `Registry Tx`: Snowtrace tx link when provided or verified.
    - Input contract chips summarizing `inputSchema` fields + toggleable **`Agent Card JSON`** inspector showing the normalized ERC-8004 + A2A metadata object.
- **`components/agent-studio.tsx` (rendered by `app/studio/agent/page.tsx`):**
  - Template preset bar (`VN Market & Macro Analyst Agent` aligned with `executor/src/templates/vn-market-analyst-agent.ts` sourced schema + defaults, and `Custom ERC-8004 Agent`).
  - Left column form organized into clear sections:
    1. **On-Chain Identity (ERC-8004):** `erc8004TokenId` (positive integer `>= 1`), canonical `erc8004Registry` (`0x8004A818BFB912233c491871b3d84c89A494BD9e` displayed read-only with Snowtrace link to match `gateway`/`executor` constraints), `taskKind` (preset `vn-market-analysis` with optional custom string + compatibility notice), Agent Wallet `payTo`, and collapsible Advanced Registration (`id` UUID + pre-anchored `registryTxHash`). No unused `code` textarea is shown since `gateway` does not forward `code` for `AUTONOMOUS_AGENT`.
    2. **Agent Profile & Task Schema:** Name, auto-synced Slug, Category, Summary, Description, Tags, `<InputSchemaBuilder />` (Visual / Raw JSON / Preview), Pricing (`PAY_PER_RUN` / `PAY_PER_RESULT` + `priceAtomic`).
  - Right column: Sticky live **`<AgentIdentityCard />`** updating as the provider edits fields!
  - Submission calls `POST /api/facet/agent-facets`; post-publish state shows the published card, `Open Agent Playground ↗` (`/facets/[id]`), and an inline **Verify Fuji Registry Tx** form calling `POST /api/facet/facets/[facetId]/verify-registry`.

### 3.8 Documentation Page (`/docs`) — `app/docs/page.tsx`
Static/Server-rendered documentation hub with sticky table-of-contents sidebar, numbered section headings, and copyable code blocks grounded in the verified codebase:
1. **01 · Overview & Multi-Modal Architecture:** Comparison table of `EXTERNAL_HTTP_API`, `HOSTED_ACTOR`, and `AUTONOMOUS_AGENT` (execution path, schema contract, pricing options, on-chain proof).
2. **02 · Integrating FACET into Your AI Agent:** Step-by-step agent integration guide covering:
   - Agent discovery → schema inspection → paid invocation loop (`search_facets` → `get_facet` → `invoke_facet`)
   - Connecting MCP-compatible agents (Claude Desktop, Cursor, Antigravity) via stdio server (`FACET_CONTROL_API_URL`, `FACET_GATEWAY_URL`, scoped low-balance Fuji payer env vars)
   - Direct TypeScript integration via `@facet/agent-sdk` (`FacetClient`) and `facet` CLI (`search`, `inspect`, `publish-actor`)
   - Direct Gateway HTTP + x402 v2 flow (`Idempotency-Key` + `PAYMENT-SIGNATURE`)
3. **03 · x402 Payment & Receipt Lifecycle:** `402 PAYMENT-REQUIRED` → `PAYMENT-SIGNATURE` → single execution → `FacetFeeSplitAndEscrow` (`PAY_PER_RUN` 95%/5% split & `PAY_PER_RESULT` TaskEscrow with refund) → `FacetReceiptLog`.
4. **04 · Publishing Capabilities (API, Actor, Agent):** Clear publishing guides for RapidAPI-style HTTP APIs, Apify-style Node.js Hosted Actors (`main.mjs` + `--network=none --read-only`), and ERC-8004 Autonomous Agents.
5. **05 · Avalanche Fuji Smart Contracts:** Verified addresses from `contracts/fuji-deployment.json` (`fUSD`, `FacetActorRegistry`, `FacetFeeSplitAndEscrow`, `FacetReceiptLog`) plus ERC-8004 Identity (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) and Reputation (`0x8004B663056A597Dffe9eCcC1965A193B7388713`) with Snowtrace links.

---

## 4. Testing & Verification Strategy

- **Preserve & pass existing backend/lib unit tests:** `control-api-server.test.ts`, `openapi-import.test.ts`, `facet-draft-workflow.test.ts`, `manual-openapi.test.ts`.
- **Update & expand UI tests:**
  - `test/page.test.tsx`: Verify `/` renders Landing Page hero, 3 modality cards, and CTAs to `/store`, `/studio`, `/docs` without embedded forms; verify `/store`, `/docs`, `/studio`, `/studio/api`, `/studio/actor`, `/studio/agent` render cleanly.
  - `test/facet-row.test.tsx`: Verify clear visual badges/metadata differences across `EXTERNAL_HTTP_API`, `HOSTED_ACTOR`, and `AUTONOMOUS_AGENT`.
  - `test/input-schema-builder.test.ts`: Test visual field conversion <-> JSON Schema 2020-12 round-trip and non-flat schema guard (`anyOf`/nested object fallback).
  - `test/actor-and-playground.test.tsx`: Verify Apify-style Actor Studio tabs, Agent Studio + On-Chain Agent Card rendering, and FacetPlayground.
  - `test/provider-import-workspace.test.tsx`: Verify RapidAPI-style API Studio Quick Endpoint + OpenAPI import + 2-pane `FacetDraftWorkbench` without exposing `secretRefId`.
- **Full verification gate (`web/`):** `npm run verify` (`format:check`, `lint`, `typecheck`, `test`, `build`), plus live Next.js smoke inspection in browser if local server is started.
