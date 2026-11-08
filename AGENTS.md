# FACET Web instructions

- This is a standalone repository. It must install, build, test and deploy without a parent folder or sibling checkout.
- Use npm only. Commit this repository's `package-lock.json`; do not join a parent workspace.
- Current scope is Phase 1 Provider Console and public Store only. Do not build Playground, wallet, MCP or payment UI.
- Follow the repository-local `docs/ui-brand-direction.md`; accessibility and reduced-motion support are acceptance criteria.
- Keep browser code free of provider secrets, database credentials and direct provider API calls.
- Consume Control API and shared contracts through versioned public interfaces, never sibling filesystem source imports.
- Vercel deployment is optional; local operation remains mandatory.
- Commit `.env.example`, never `.env` or `.env.local`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
