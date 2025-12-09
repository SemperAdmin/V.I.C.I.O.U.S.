-- Extend unit configuration tables to support full app features
alter table if exists public.unit_sections
  add column if not exists company_id text,
  add column if not exists display_name text;

alter table if exists public.unit_sub_tasks
  add column if not exists location text,
  add column if not exists instructions text;

-- Keep RLS disabled as per existing configuration
alter table if exists public.unit_sections disable row level security;
alter table if exists public.unit_sub_tasks disable row level security;
