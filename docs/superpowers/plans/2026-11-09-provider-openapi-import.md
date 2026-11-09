# Provider OpenAPI Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 1 Slice 2 with a local-first Provider Console that imports OpenAPI sources through a narrow Next.js BFF, observes job progress, and previews operation candidates.

**Architecture:** Fixed Next.js Route Handlers proxy only the approved Control API endpoints and keep the local development identity server-side. A small client component owns form/polling state while the existing page remains server-rendered; pure helpers isolate status transitions and request shaping for unit tests.

**Tech Stack:** Next.js 16.4 App Router, React 19.3, strict TypeScript 6, native Fetch API, Vitest 5, npm.

**Spec:** `docs/superpowers/specs/2026-11-09-provider-openapi-import-design.md`

## Global Constraints

- Phase 1 only; do not create Facets, execute provider APIs, or add wallet, payment, MCP, or blockchain behavior.
- Keep `FACET_CONTROL_API_URL` and `FACET_LOCAL_DEV_USER` server-only; no `NEXT_PUBLIC_` backend/auth configuration.
- Proxy only fixed Control API routes and validate dynamic job IDs as UUIDs.
- Do not add a dependency; use the installed Next.js, React, and platform APIs.
- Upload remains a bounded UTF-8 JSON-content fallback and must not be described as multipart.
- Render all provider-controlled strings as React text, never raw HTML.
- Preserve the user's existing `next-env.d.ts` change.

## Review Focus

- A malformed job ID must return `400 INPUT_INVALID` without calling the Control API.
- A configured local identity must never appear in a browser response or client bundle.
- A Control API `4xx/5xx` JSON envelope must retain its status and safe body instead of becoming an unrelated UI error.
- A network/configuration failure must return a redacted `CONTROL_API_UNAVAILABLE` response.
- Polling must stop for `ready`, `failed`, and `expired`, and must not update state after unmount.

---

### Task 1: Server-only Control API adapter and fixed BFF routes

**Files:**
- Create: `lib/control-api-server.ts`
- Create: `app/api/facet/providers/route.ts`
- Create: `app/api/facet/openapi-imports/route.ts`
- Create: `app/api/facet/openapi-imports/[jobId]/route.ts`
- Create: `app/api/facet/openapi-imports/[jobId]/operations/route.ts`
- Create: `test/control-api-server.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `proxyControlApi(request: Request, path: string, init?: { method?: "GET" | "POST"; body?: string }): Promise<Response>`.
- Produces: `validateJobId(value: string): boolean`.
- Consumes: server-only `FACET_CONTROL_API_URL`, `FACET_ENV`, and `FACET_LOCAL_DEV_USER`.

- [x] **Step 1: Write failing proxy tests**

Add tests asserting fixed upstream URL construction, `cache: "no-store"`, local auth header injection, preserved upstream status/body, invalid UUID rejection without fetch, and redacted network failure.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npm test -- test/control-api-server.test.ts`

Expected: FAIL because `lib/control-api-server.ts` and Route Handlers do not exist.

- [x] **Step 3: Implement the adapter and four Route Handlers**

Use server-only environment access, the standard `Request`/`Response` APIs, explicit methods, UUID validation, JSON content type, `redirect: "error"`, and `cache: "no-store"`. Do not accept a caller-supplied upstream path.

- [x] **Step 4: Update `.env.example`**

Replace the public Control API URL with `FACET_ENV=local`, `FACET_CONTROL_API_URL=http://localhost:4000`, and `FACET_LOCAL_DEV_USER=demo-owner`; retain Clerk placeholders.

- [x] **Step 5: Run focused and static checks**

Run: `npm test -- test/control-api-server.test.ts && npm run typecheck && npm run lint`

Expected: all pass.

- [x] **Step 6: Commit**

Commit only Task 1 files with message `feat: add Control API BFF routes`.

### Task 2: Import contracts and client state helpers

**Files:**
- Create: `lib/openapi-import.ts`
- Create: `test/openapi-import.test.ts`

**Interfaces:**
- Produces: `ImportSourceKind`, `ImportJob`, `OperationCandidate`, `ImportWorkspaceState`.
- Produces: `isTerminalImportStatus(status): boolean`, `toImportRequest(input): CreateImportRequest`, and `readErrorEnvelope(value): string`.
- Consumes: the existing Control API response shapes documented by the Slice 2 API.

- [x] **Step 1: Write failing helper tests**

Cover all terminal/non-terminal statuses, URL/paste/upload request shaping, empty/error-envelope fallbacks, and five MiB upload boundary constants.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npm test -- test/openapi-import.test.ts`

Expected: FAIL because `lib/openapi-import.ts` does not exist.

- [x] **Step 3: Implement minimal strict types and pure helpers**

Keep wire statuses lowercase to match the implemented Control API. Preserve warnings as unknown data and expose a safe text formatter rather than trusting their structure.

- [x] **Step 4: Run focused tests**

Run: `npm test -- test/openapi-import.test.ts`

Expected: all pass.

- [x] **Step 5: Commit**

Commit Task 2 files with message `feat: model OpenAPI import UI state`.

### Task 3: Accessible Provider Import workspace

**Files:**
- Create: `components/provider-import-workspace.tsx`
- Create: `test/provider-import-workspace.test.tsx`
- Modify: `components/publish-preview-dialog.tsx`

**Interfaces:**
- Produces: `ProviderImportWorkspace()` Client Component.
- Consumes: `/api/facet/providers`, `/api/facet/openapi-imports`, job and operation BFF endpoints, and Task 2 helpers.

- [x] **Step 1: Write a failing render test**

Assert the initial markup contains a named Provider Console region, provider/source controls, URL/paste/upload choices, source-name input, accurate upload fallback copy, and an accessible live status region.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npm test -- test/provider-import-workspace.test.tsx`

Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement the workspace form and membership loading**

Use a contained Client Component. Load memberships once, select the first membership by default, require provider/name/source-specific input, read a text upload only after type/size checks, and show safe errors.

- [x] **Step 4: Implement submit, bounded polling, and operation preview**

Submit once, poll only non-terminal jobs, stop on ready/failed/expired/unmount/deadline, fetch operations on ready, and expose keyboard-operable local operation selection without persistence claims.

- [x] **Step 5: Replace the placeholder publish dialog behavior**

Make the existing call-to-action navigate to `#provider-console`; remove obsolete claims that URL import is disabled.

- [x] **Step 6: Run component/helper tests and checks**

Run: `npm test -- test/provider-import-workspace.test.tsx test/openapi-import.test.ts && npm run typecheck && npm run lint`

Expected: all pass.

- [x] **Step 7: Commit**

Commit Task 3 files with message `feat: add Provider OpenAPI import workspace`.

### Task 4: Page integration, FACET styling, documentation, and verification

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`
- Modify: `docs/ui-brand-direction.md`
- Test: all files under `test/`

**Interfaces:**
- Consumes: `ProviderImportWorkspace` from Task 3.
- Produces: a responsive `#provider-console` section and standalone local run instructions.

- [x] **Step 1: Integrate the workspace and remove stale foundation content**

Keep the landing/catalog Server Component, add the workspace after the catalog, update navigation/call-to-action anchors, and remove the obsolete remote-fetch warning.

- [x] **Step 2: Add responsive FACET design-system styles**

Style step rail, source switcher, form fields, job status, warning/error banners, and operation rows using existing tokens. Add narrow-screen layouts, visible checked/focus states, and no required animation.

- [x] **Step 3: Update standalone documentation**

Document BFF environment variables and the required local startup order for `control-api`, worker, and importer. Record that Clerk and multipart upload remain deferred.

- [x] **Step 4: Run complete verification**

Run: `npm run verify`

Expected: formatting, lint, type-check, all Vitest tests, and production build pass.

- [x] **Step 5: Run local multi-service smoke test**

With the three backend processes running, submit one paste fixture and one isolated HTTPS URL from the UI; verify terminal job states and operation candidates without browser-visible dev auth headers.

- [x] **Step 6: Inspect repository boundaries**

Run: `git status --short` and confirm only intended `web` files are staged, excluding the pre-existing `next-env.d.ts` change.

- [x] **Step 7: Commit**

Commit Task 4 files with message `feat: complete OpenAPI import console`.
