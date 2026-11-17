# FACET Web Multi-Page & Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `web` into dedicated routes (`/`, `/store`, `/facets/[facetId]`, `/studio`, `/studio/api`, `/studio/actor`, `/studio/agent`, `/docs`) with a 3-item navbar (`Store`, `Studio`, `Docs` + logo to `/`), distinct type UX across API/Actor/Agent, RapidAPI-style API Hub, Apify-style Actor Studio, ERC-8004 On-Chain Agent Card Studio, and comprehensive Docs including an Agent Integration guide.

**Architecture:** Server-rendered App Router pages share a sticky `SiteHeader` and `SiteFooter`. Interactive workspaces live in focused Client Components (`ProviderSelectorBar`, `InputSchemaBuilder`, `ActorStudio`, `ApiStudio`, `FacetDraftWorkbench`, `AgentStudio`, `AgentIdentityCard`, `FacetPlayground`) backed by existing `/api/facet/*` BFF routes with zero backend or contract changes.

**Tech Stack:** Next.js 16.4 App Router, React 19.3, TypeScript 6, Vitest 5, `@clerk/nextjs`, CSS Grid/Custom Properties (`app/globals.css`).

**Spec:** `web/docs/superpowers/specs/2026-11-17-web-multipage-redesign-design.md`

## Global Constraints
- Modify files only inside `web/` (plus docs/plan under `web/docs/`). Do not modify `control-api/`, `gateway/`, `executor/`, `contracts/`, `api-contracts/`, or `/api/facet/*` BFF logic.
- Preserve existing uncommitted files (`proxy.ts`, `app/layout.tsx`, `.github/workflows/docker-publish.yml`, `next-env.d.ts`, `package.json`, `package-lock.json`).
- Keep all UI chrome, labels, errors, and documentation in English; preserve Vietnamese sample presets as payload templates.
- Never render `secretRefId` or raw secrets in UI/DOM; preserve exact OpenAPI upload/URL boundary accuracy copy.
- Navbar must have 3 navigation items (`Store`, `Studio`, `Docs`); FACET logo on the left navigates to `/` (no `Home` link).
- Verification gate: `npm run verify` (`format:check && lint && typecheck && test && build`) must exit 0.

---

### Task 1: Shared UI Utilities, App Shell (`SiteHeader`, `SiteFooter`), and Auth Back-Links

**Files:**
- Create: `lib/facet-ui.ts`
- Create: `components/site-header.tsx`
- Create: `components/site-footer.tsx`
- Modify: `app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `app/sign-up/[[...sign-up]]/page.tsx`
- Create: `test/facet-ui.test.ts`

- [ ] **Step 1: Write failing tests in `test/facet-ui.test.ts` for `lib/facet-ui.ts` helpers and `SiteHeader` (3 nav items, logo to `/`, no Home button).**
- [ ] **Step 2: Run `npm test -- test/facet-ui.test.ts` and verify failure.**
- [ ] **Step 3: Implement `lib/facet-ui.ts`, `components/site-header.tsx`, `components/site-footer.tsx`, and update `sign-in`/`sign-up` back-links.**
- [ ] **Step 4: Run `npm test -- test/facet-ui.test.ts` and verify pass.**

---

### Task 2: Landing Page (`/`), Facet Store (`/store`), `FacetRow`, `AgentIdentityCard`, `FacetPlayground` (`array` support), and `/facets/[facetId]`

**Files:**
- Modify: `app/page.tsx`
- Create: `app/store/page.tsx`
- Modify: `components/facet-row.tsx`
- Create: `components/agent-identity-card.tsx`
- Modify: `components/facet-playground.tsx`
- Modify: `app/facets/[facetId]/page.tsx`
- Modify: `test/page.test.tsx`
- Modify: `test/facet-row.test.tsx`
- Modify: `test/actor-and-playground.test.tsx`

- [ ] **Step 1: Update `test/page.test.tsx`, `test/facet-row.test.tsx`, and `test/actor-and-playground.test.tsx` with failing assertions for Landing `/`, `/store`, modality badges, `AgentIdentityCard`, and `array` input handling in `FacetPlayground`.**
- [ ] **Step 2: Run tests (`npm test -- test/page.test.tsx test/facet-row.test.tsx test/actor-and-playground.test.tsx`) and verify failure.**
- [ ] **Step 3: Implement `components/agent-identity-card.tsx`, update `components/facet-row.tsx`, update `components/facet-playground.tsx` (`array` field support), refactor `app/page.tsx` to pure Landing Page, create `app/store/page.tsx`, and upgrade `app/facets/[facetId]/page.tsx`.**
- [ ] **Step 4: Run focused tests and verify pass.**

---

### Task 3: Shared Studio Shell, Provider Selector Bar, Visual Input Schema Builder, and `/studio` Hub

**Files:**
- Create: `lib/input-schema-builder.ts`
- Create: `lib/use-provider-workspace.ts`
- Create: `components/input-schema-builder.tsx`
- Create: `components/provider-selector-bar.tsx`
- Create: `components/studio-shell.tsx`
- Create: `app/studio/page.tsx`
- Create: `test/input-schema-builder.test.ts`

- [ ] **Step 1: Write failing unit tests in `test/input-schema-builder.test.ts` for schema-to-fields conversion, required/enum/default handling, and complex-schema Raw JSON fallback guard (`anyOf`, nested objects).**
- [ ] **Step 2: Run `npm test -- test/input-schema-builder.test.ts` and verify failure.**
- [ ] **Step 3: Implement `lib/input-schema-builder.ts`, `components/input-schema-builder.tsx`, `lib/use-provider-workspace.ts`, `components/provider-selector-bar.tsx`, `components/studio-shell.tsx`, and `app/studio/page.tsx`.**
- [ ] **Step 4: Run `npm test -- test/input-schema-builder.test.ts` and verify pass.**

---

### Task 4: Apify-Inspired Actor Studio (`/studio/actor`) and ERC-8004 Agent Studio (`/studio/agent`)

**Files:**
- Modify: `lib/actor-templates.ts`
- Create: `components/actor-studio.tsx`
- Create: `components/agent-studio.tsx`
- Create: `app/studio/actor/page.tsx`
- Create: `app/studio/agent/page.tsx`
- Modify: `components/actor-agent-studio.tsx` (retire/delegate cleanly or remove unused)
- Modify: `test/actor-and-playground.test.tsx`

- [ ] **Step 1: Add failing assertions in `test/actor-and-playground.test.tsx` for `ActorStudio` (Apify-style tabs, presets, container spec, publish button) and `AgentStudio` (ERC-8004 On-Chain Agent Card live preview, `erc8004TokenId >= 1`, `taskKind`).**
- [ ] **Step 2: Run `npm test -- test/actor-and-playground.test.tsx` and verify failure.**
- [ ] **Step 3: Update `lib/actor-templates.ts` (keeping runnable Actor presets + aligning `AGENT_TEMPLATE_PRESET` schema with `executor` sourced arrays + adding blank templates), implement `components/actor-studio.tsx`, `components/agent-studio.tsx`, `app/studio/actor/page.tsx`, and `app/studio/agent/page.tsx`.**
- [ ] **Step 4: Run `npm test -- test/actor-and-playground.test.tsx` and verify pass.**

---

### Task 5: RapidAPI-Inspired API Provider Hub (`/studio/api`) and 2-Pane `FacetDraftWorkbench`

**Files:**
- Create: `components/api-studio.tsx`
- Modify: `components/provider-import-workspace.tsx`
- Modify: `components/facet-draft-workbench.tsx`
- Create: `app/studio/api/page.tsx`
- Modify: `test/provider-import-workspace.test.tsx`

- [ ] **Step 1: Update `test/provider-import-workspace.test.tsx` with assertions for RapidAPI-style `ApiStudio` (Quick Endpoint + OpenAPI Spec modes, accurate upload/URL notices, 4-stage pipeline) and 2-pane `FacetDraftWorkbench` (left endpoint selector + right `General & Catalog` / `Gateway & Auth` / `Validate & Publish` tabs without exposing `secretRefId`).**
- [ ] **Step 2: Run `npm test -- test/provider-import-workspace.test.tsx` and verify failure.**
- [ ] **Step 3: Implement `components/api-studio.tsx`, upgrade `components/facet-draft-workbench.tsx`, wire `app/studio/api/page.tsx`, and keep `components/provider-import-workspace.tsx` cleanly bridged or deprecated.**
- [ ] **Step 4: Run `npm test -- test/provider-import-workspace.test.tsx` and verify pass.**

---

### Task 6: Documentation Page (`/docs`), Design System CSS (`app/globals.css`), and Full Verification

**Files:**
- Create: `components/copy-code-block.tsx`
- Create: `app/docs/page.tsx`
- Modify: `app/globals.css`
- Modify: `test/page.test.tsx` (verify `/docs` renders Agent Integration guide + Fuji contracts)

- [ ] **Step 1: Add `/docs` rendering test in `test/page.test.tsx` checking sections `01`–`05`, Agent Integration guide (`search_facets`, `get_facet`, `invoke_facet`, `FacetClient`, MCP config), and verified Fuji contract addresses.**
- [ ] **Step 2: Run `npm test -- test/page.test.tsx` and verify failure.**
- [ ] **Step 3: Implement `components/copy-code-block.tsx`, `app/docs/page.tsx`, and update `app/globals.css` with complete responsive styling for Landing, Store, Studio Hub, Apify Actor Studio, RapidAPI 2-Pane Hub, On-Chain Agent Card, Playground, and Docs.**
- [ ] **Step 4: Run `npm run format` (within `web/`) and then run `npm run verify` (`format:check && lint && typecheck && test && build`) and confirm 0 errors/failures.**
