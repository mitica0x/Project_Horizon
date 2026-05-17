# Horiz0n P2–P9 — Database migrations

Run these in the **Supabase SQL editor**, in order, **before launching**:

1. `002_outcome_tracking.sql` — adds `outcome_note`, `outcome_status`, `outcome`
   columns to the existing `public.activations` table (P4).
2. `003_decisions.sql` — creates `public.decisions` (P5).
3. `004_war_room_sessions.sql` — creates `public.war_room_sessions` (P6).

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
