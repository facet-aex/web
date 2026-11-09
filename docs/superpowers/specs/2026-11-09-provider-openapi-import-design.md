# Provider OpenAPI Import UI Design

**Status:** Approved direction
**Date:** 2026-11-09
**Phase:** 1, Slice 2 UI completion

## Goal

Give a local provider a complete browser flow for submitting an OpenAPI 3.0.x or 3.1.x source, observing the asynchronous import job, and reviewing provider-private operation candidates produced by the existing Control API worker.

## Scope

The UI supports:

- choosing one of the authenticated user's provider memberships;
- importing by isolated HTTPS URL, pasted text, or local text-file upload;
- polling the resulting import job until it is ready or failed;
- displaying safe job errors, warnings, and normalized operation candidates;
- selecting operation candidates as a non-persistent preview for Slice 3.

The UI does not create Facets, map upstream authentication, publish, execute provider APIs, or add payments, wallet, MCP, or blockchain behavior.

## Architecture

The browser calls fixed Next.js Route Handlers under `/api/facet`. Those handlers form a narrow backend-for-frontend adapter to the existing Control API. The Control API base URL and local development identity remain server-only environment variables; browser components never construct arbitrary upstream paths or send `x-facet-dev-*` headers.

The adapter exposes only:

- `GET /api/facet/providers` → `GET /v1/me/providers`;
- `POST /api/facet/openapi-imports` → `POST /v1/openapi-imports`;
- `GET /api/facet/openapi-imports/{uuid}` → `GET /v1/openapi-imports/{uuid}`;
- `GET /api/facet/openapi-imports/{uuid}/operations` → `GET /v1/openapi-imports/{uuid}/operations`.

Job IDs are validated as UUIDs before an upstream URL is constructed. The proxy does not accept an arbitrary target URL, forwards only JSON, disables fetch caching, and returns the Control API status plus safe JSON envelope. Network/configuration failures become a stable `CONTROL_API_UNAVAILABLE` response without leaking server configuration.

For local development, `FACET_ENV=local` permits the BFF to add `x-facet-dev-user` from `FACET_LOCAL_DEV_USER`. Outside local mode, that fallback is disabled; Clerk/token forwarding is a later identity-adapter step and is not simulated here.

## UI Flow

The Provider Console is presented as a focused step sequence:

1. **Provider** — load memberships and select a provider with a role label.
2. **Source** — choose URL, paste, or upload and enter a source name.
3. **Import** — submit once, show the job ID and poll its server-owned state.
4. **Operations** — when ready, retrieve operation candidates, show method/path/summary/warnings, and allow local selection.

URL import is described as isolated HTTPS fetching performed by the importer. Upload accurately states that the local demo reads a bounded UTF-8 text file and sends the current JSON-content fallback; it must not claim multipart upload.

The current landing page remains a Server Component. Only the import workspace is a Client Component. The obsolete “remote fetching is not enabled” content is replaced by the live Provider Console section, and the existing publish call-to-action scrolls to it rather than presenting a placeholder modal.

## State and Failure Behavior

The client owns one import attempt at a time. Its state is one of `idle`, `submitting`, `polling`, `ready`, or `failed`. Polling stops on `ready`, `failed`, `expired`, component unmount, or after a bounded client wait; the server job remains the source of truth and can be reloaded later when history UI is added.

Validation occurs on both sides of the browser boundary:

- the form requires provider, source name, and source-specific input;
- upload accepts text-like JSON/YAML files and enforces the documented five MiB boundary before reading;
- Route Handlers validate UUID path parameters and JSON shape enough to prevent open proxy behavior;
- the Control API remains authoritative for membership, HTTPS, byte, parser, reference, and operation limits.

Errors are rendered as text only. OpenAPI summaries and warnings are never rendered as HTML, preventing stored markup from executing in the console.

## Accessibility and Visual Direction

The workspace follows the existing FACET design system: black field, warm-white text, electric-lime selection/action, technical mono labels, hard dividers, and an editorial split layout. It uses semantic form controls, a live status region, an error summary, keyboard-operable source tabs and operation checkboxes, visible focus, 44px practical targets, narrow-screen stacking, and reduced-motion behavior inherited from the global stylesheet.

## Testing

- Unit-test the import state helpers and terminal-status decisions.
- Unit-test the BFF proxy for fixed paths, auth-header behavior, upstream status preservation, invalid UUID rejection, and unavailable-backend redaction.
- Render-test the workspace's initial accessible structure without requiring a browser test dependency.
- Run formatting, lint, type-check, Vitest, and Next.js production build.
- Manually smoke-test the local flow against `control-api`, its worker, and `openapi-importer` once automated checks pass.

## Deferred Work

- Clerk browser integration and non-local token exchange;
- multipart/streaming upload;
- persisted operation selection and Facet creation (Slice 3);
- import history/resume UI;
- browser automation and visual regression infrastructure.
