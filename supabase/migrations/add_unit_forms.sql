-- Unit forms table (currently uses localStorage via formsStore.ts)
create table if not exists public.unit_forms (
  id bigserial primary key,
  unit_id text not null,
  name text not null,
  kind text not null check (kind in ('Inbound', 'Outbound')),
  task_ids jsonb not null default '[]'::jsonb,
  purpose text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add unique constraint for form names per unit
create unique index if not exists idx_unit_forms_unique_name
  on public.unit_forms(unit_id, lower(name));

-- Add index for faster lookups
create index if not exists idx_unit_forms_unit_id on public.unit_forms(unit_id);
create index if not exists idx_unit_forms_kind on public.unit_forms(kind);

-- Disable RLS for now (enable with policies later for production)
alter table public.unit_forms disable row level security;
