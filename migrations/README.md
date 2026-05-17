# Horiz0n P2–P9 — Database migrations

Run these in the **Supabase SQL editor**, in order, **before launching**:

1. `002_outcome_tracking.sql` — adds `outcome_note`, `outcome_status`, `outcome`
   columns to the existing `public.activations` table (P4).
2. `003_decisions.sql` — creates `public.decisions` (P5).
3. `004_war_room_sessions.sql` — creates `public.war_room_sessions` (P6).
4. `005_scan_results.sql` — creates `scan_results` (production crawler output).
5. `006_market_moves.sql` — creates `market_moves` (competitor news intel).

Production backend notes (005 / 006):

- These are written by the Railway backend using the Supabase **service
  key**, which bypasses RLS. The frontend reads them through the backend
  (`/api/scan/latest`, `/api/market-moves`) — it does **not** query these
  tables directly — so the `org_isolation` RLS policy is defense-in-depth.
- That policy uses `users WHERE id = auth.uid()`; the rest of the app keys
  `users` by `email`. If `users.id` is not the auth UID, direct client reads
  would return nothing — but the app path does not depend on it (reads go
  through the service-key backend). Adjust the policy to email-based if you
  later expose direct client reads.
- `006` adds a UNIQUE index on `(org_id, source_url)` — required for the
  news `upsert(..., { onConflict: 'org_id,source_url' })` to dedupe.
- Unlike 002–004 these follow the spec's exact DDL and are **not** idempotent
  (`CREATE TABLE` / `CREATE POLICY` will error if re-run). Drop the objects
  first if you need to re-apply.

Notes:

- `public.activations` is assumed to **already exist** server-side (it is the
  table the frontend write-path in P3 inserts into). Migration `001` is
  intentionally absent — only the new outcome columns are added.
- All scripts are idempotent (`IF NOT EXISTS`) — safe to re-run.
- Each script has a commented, optional **RLS policy** block. The app already
  scopes every query by `org_id`; enabling RLS adds defense-in-depth at the
  database. Uncomment if you want DB-enforced org isolation.
- If a table/column is missing at runtime the UI **does not crash** — it
  surfaces a muted notice and logs to the console (P1 is never affected).
