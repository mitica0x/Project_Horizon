-- Horiz0n P6 — War Room Mode
-- Logs each War Room activation (start → end + notes).
-- Run in the Supabase SQL editor (after 003). Idempotent.

CREATE TABLE IF NOT EXISTS public.war_room_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id),
  trigger_type text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS war_room_org_idx
  ON public.war_room_sessions (org_id, started_at DESC);

-- Optional org isolation (recommended — uncomment to enforce at the DB).
--
-- ALTER TABLE public.war_room_sessions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY war_room_org_isolation ON public.war_room_sessions
--   USING (org_id = (SELECT org_id FROM public.users WHERE email = auth.jwt() ->> 'email'));
