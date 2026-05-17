-- Horiz0n P5 — Decision Ledger
-- Every activate / skip / defer on an event is recorded here.
-- Run in the Supabase SQL editor (after 002). Idempotent.

CREATE TABLE IF NOT EXISTS public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id),
  event_name text,
  decision text CHECK (decision IN ('activate', 'skip', 'defer')),
  rationale text,
  context_snapshot jsonb,
  competitor_moves jsonb,
  decided_at timestamptz DEFAULT now(),
  revisit_at timestamptz,
  revisit_note text
);

CREATE INDEX IF NOT EXISTS decisions_org_idx
  ON public.decisions (org_id, decided_at DESC);

-- Optional org isolation (recommended — uncomment to enforce at the DB).
-- The app already scopes every query by org_id; enable RLS for defense in depth.
--
-- ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY decisions_org_isolation ON public.decisions
--   USING (org_id = (SELECT org_id FROM public.users WHERE email = auth.jwt() ->> 'email'));
