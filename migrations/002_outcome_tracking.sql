-- Horiz0n P4 — Campaign Outcome Tracking
-- Adds outcome columns to the existing public.activations table.
-- Run in the Supabase SQL editor. Idempotent (IF NOT EXISTS).

ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS outcome_note text;

ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS outcome_status text DEFAULT 'pending';

ALTER TABLE public.activations
  ADD COLUMN IF NOT EXISTS outcome text
  CHECK (outcome IN ('win', 'neutral', 'miss'));
