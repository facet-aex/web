# FACET Web instructions

- This is a standalone repository. It must install, build, test and deploy without a parent folder or sibling checkout.
- Current scope is Phase 1 Provider Console and public Store only. Do not build Playground, wallet, MCP or payment UI.
- Follow `docs/ui-brand-direction.md`; accessibility and reduced-motion support are acceptance criteria.
- Keep browser code free of provider secrets, database credentials and direct provider API calls.
- Consume Control API and shared contracts through versioned public interfaces, never sibling filesystem source imports.
- Vercel deployment is optional; local operation remains mandatory.
- Commit `.env.example`, never `.env` or `.env.local`.
