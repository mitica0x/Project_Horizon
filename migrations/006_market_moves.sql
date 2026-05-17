-- Horiz0n production backend — market_moves
-- Competitor news intelligence (Google News RSS). Written server-side via
-- the Supabase service key. Run in the Supabase SQL editor (after 005).

CREATE TABLE market_moves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES orgs(id),
  detected_at timestamptz DEFAULT now(),
  competitor text NOT NULL,
  headline text NOT NULL,
  source_url text,
  impact_level text DEFAULT 'MEDIUM',
  move_type text DEFAULT 'ANNOUNCEMENT',
  raw_snippet text
);

-- Required for the news upsert: fetchCompetitorNews() upserts on
-- (org_id, source_url) so the same article is not duplicated per org while
-- still allowing the same URL to exist across different orgs.
CREATE UNIQUE INDEX market_moves_org_source_uniq
  ON market_moves (org_id, source_url);

CREATE INDEX market_moves_org_detected_idx
  ON market_moves (org_id, detected_at DESC);

ALTER TABLE market_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON market_moves
  USING (org_id = (SELECT org_id FROM users
    WHERE id = auth.uid()));
