-- Add contact info fields to users table
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS phone_number text NULL;

-- Optional: simple index for faster lookups by email (non-unique)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
