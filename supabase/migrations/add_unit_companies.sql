-- Unit companies table (referenced in supabaseUnitConfigService but missing)
create table if not exists public.unit_companies (
  id bigserial primary key,
  unit_id text not null,
  company_id text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Add index for faster lookups
create index if not exists idx_unit_companies_unit_id on public.unit_companies(unit_id);

-- Disable RLS for now (enable with policies later for production)
alter table public.unit_companies disable row level security;
