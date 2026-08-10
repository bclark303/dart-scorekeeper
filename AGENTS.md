<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dart Scorekeeper portability rules

The application is intentionally provider-neutral. Vercel and Turso are deployment choices, not application architecture.

- SQLite is the canonical database dialect.
- React/client components must never connect to a database provider directly.
- Database provider imports belong under `lib/db/adapters/` only.
- Application code reaches persistence through repository functions under `lib/db/repositories/`.
- Do not introduce Vercel-, Turso-, Supabase-, or Cloudflare-specific APIs into game/domain code.
- Prefer standard Next.js App Router, Route Handlers, Web APIs, and Node-compatible behavior.
- Keep schema changes in `lib/db/schema.ts` and commit generated migrations under `drizzle/`.
- Keep secrets server-side. Never expose database URLs or auth tokens through `NEXT_PUBLIC_*` variables.
- Local development and Docker must remain able to use a `file:` SQLite/libSQL database.
- A successful Docker build is part of the portability contract; do not assume the Vercel filesystem is persistent.
- If a future provider needs different behavior (for example Cloudflare D1), add an adapter rather than changing callers throughout the app.
