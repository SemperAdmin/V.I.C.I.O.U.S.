-- Add form_type and purpose columns to installation_sub_tasks table
-- These fields allow installation tasks to link to unit-level forms

ALTER TABLE public.installation_sub_tasks
ADD COLUMN IF NOT EXISTS form_type text NULL;

ALTER TABLE public.installation_sub_tasks
ADD COLUMN IF NOT EXISTS purpose text NULL;

-- Add check constraint for form_type
ALTER TABLE public.installation_sub_tasks
ADD CONSTRAINT installation_sub_tasks_form_type_check
CHECK (form_type IS NULL OR form_type IN ('Inbound', 'Outbound'));

-- Add check constraint for purpose
ALTER TABLE public.installation_sub_tasks
ADD CONSTRAINT installation_sub_tasks_purpose_check
CHECK (purpose IS NULL OR purpose IN (
  'Fleet_Assistance_Program',
  'TAD_31_plus_days',
  'TAD_30_or_less',
  'PCA',
  'PCS',
  'Separation',
  'Retirement'
));

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_installation_sub_tasks_form_type
ON public.installation_sub_tasks (form_type);

CREATE INDEX IF NOT EXISTS idx_installation_sub_tasks_purpose
ON public.installation_sub_tasks (purpose);
