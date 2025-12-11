-- Create sponsorship_coordinators table
CREATE TABLE IF NOT EXISTS public.sponsorship_coordinators (
  id SERIAL PRIMARY KEY,
  coordinator_edipi TEXT NOT NULL,
  ruc TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coordinator_edipi, ruc)
);

-- Create index for faster lookups by RUC
CREATE INDEX IF NOT EXISTS idx_sponsorship_coordinators_ruc
  ON sponsorship_coordinators (ruc);

-- Create index for faster lookups by coordinator
CREATE INDEX IF NOT EXISTS idx_sponsorship_coordinators_edipi
  ON sponsorship_coordinators (coordinator_edipi);

-- Disable RLS for simplicity (similar to other admin tables)
ALTER TABLE public.sponsorship_coordinators DISABLE ROW LEVEL SECURITY;

-- Add sponsor assignment fields to my_form_submissions
ALTER TABLE IF EXISTS my_form_submissions
ADD COLUMN IF NOT EXISTS destination_unit_id TEXT;

ALTER TABLE IF EXISTS my_form_submissions
ADD COLUMN IF NOT EXISTS assigned_sponsor_edipi TEXT;

ALTER TABLE IF EXISTS my_form_submissions
ADD COLUMN IF NOT EXISTS assigned_sponsor_name TEXT;

-- Create index for finding submissions by destination RUC
CREATE INDEX IF NOT EXISTS idx_my_form_submissions_destination
  ON my_form_submissions (destination_unit_id);
