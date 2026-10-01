# LUMORA — Autonomous Creative Studio (Phase 1 foundation)

Monorepo: `apps/web` (Next.js 15, App Router), `packages/core` (permission model), `supabase/migrations`.

## Setup
1. `cp .env.example apps/web/.env.local` and fill the publishable key. Never commit real keys.
2. `npm install && npm test && npm run typecheck && npm run build`
3. **Before applying the migration**, compare it with the live `lumora` schema (see header assumptions), then run it via Supabase SQL editor or `supabase db push`.
4. Railway: connect the repo, set the two `NEXT_PUBLIC_*` variables. `railway.json` is included.

## Security model
Isolation is enforced by Postgres RLS (`lumora_is_member`, role helpers). The browser and server code use only the publishable key; roles and organization_id are never trusted from the client. `audit_logs` has no update/delete for users.
