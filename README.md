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

Open `http://localhost:3000`. The current Store records are labeled local demo data; they will be replaced by the Control API catalog endpoint. Run `npm run verify` before committing.
