-- Add role flags and section role while preserving existing schema
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_unit_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_app_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS section_role text NULL;

-- Optional: backfill section_role from org_role when it matches expected values
UPDATE public.users
SET section_role = CASE
  WHEN org_role IN ('Section_Reviewer') THEN 'Section_Reviewer'
  WHEN org_role IN ('Member') THEN 'Member'
  ELSE section_role
END
WHERE section_role IS NULL;

-- Note: keep org_role for backward compatibility; app logic can prefer flags/section_role
