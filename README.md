# FACET Web

Standalone Next.js repository for the FACET Provider Console and public Facet Store.

**Phase:** 1 — active.
**Deployment:** local-first; optional Vercel preview.
**Boundary:** calls published FACET APIs only. It never calls provider APIs, reads provider secrets or imports sibling source code.

This repository uses npm and owns its package configuration, `package-lock.json`, environment variables, CI and UI documentation. See `AGENTS.md` and `docs/ui-brand-direction.md` before coding.

## Local setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The web repository keeps its backend configuration server-side:

```dotenv
FACET_ENV=local
FACET_CONTROL_API_URL=http://localhost:4000
FACET_LOCAL_DEV_USER=demo-owner
```

`FACET_LOCAL_DEV_USER` is converted to the Control API's local-development header only inside fixed Next.js Route Handlers. It is never exposed through a `NEXT_PUBLIC_` variable. Outside `FACET_ENV=local`, the development identity fallback is disabled. Clerk browser/session integration remains pending.

## OpenAPI import demo

Run each standalone repository from its own clone/configuration. The required startup order is:

1. Start `openapi-importer` on `127.0.0.1:4010` with `npm run dev`.
2. Start `control-api` on `127.0.0.1:4000` with `npm run dev`.
3. Start the Control API worker in a second `control-api` terminal with `npm run worker:dev`.
4. Start this repository with `npm run dev`, then open `http://localhost:3000/#provider-console`.

The configured local user needs a provider membership. If the database does not yet contain one, create it against the Control API using the same development identity:

```bash
curl --request POST http://localhost:4000/v1/providers \
  --header 'content-type: application/json' \
  --header 'x-facet-dev-user: demo-owner' \
  --data '{"slug":"facet-demo","name":"FACET Demo Provider","description":"Local Phase 1 provider"}'
```

The Provider Console supports isolated HTTPS URL import, paste, and local text-file upload. Upload currently reads a maximum 5 MiB JSON/YAML file in the browser and sends the Control API's JSON-content fallback; multipart/streaming upload is not implemented.

The Next.js BFF applies a bounded streaming read to the import command before forwarding it. The Control API independently enforces both its JSON transport limit and the decoded 5 MiB document limit.

The public Store still uses records labeled local demo data until the Control API catalog endpoint lands. Run `npm run verify` before committing.
