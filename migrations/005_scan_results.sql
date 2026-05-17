-- Horiz0n production backend — scan_results
-- Real crawler output (replaces seeded scan data). Written server-side via
-- the Supabase service key (bypasses RLS); the RLS policy below is
-- defense-in-depth for any direct client reads.
-- Run in the Supabase SQL editor.

CREATE TABLE scan_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  scanned_at timestamptz DEFAULT now(),
  url text NOT NULL,
  path text,
  geo text,
  tier text,
  bybit_present boolean DEFAULT false,
  competitors_present text[] DEFAULT '{}',
  opp_score integer,
  raw_html_snippet text,
  status text DEFAULT 'active'
);

CREATE INDEX scan_results_org_scanned_idx
  ON scan_results (org_id, url, scanned_at DESC);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON scan_results
  USING (org_id = (SELECT org_id FROM users
    WHERE id = auth.uid()));
