-- Installations table for V.I.C.I.O.U.S.
-- Installation-level governance that overlays units

create table if not exists public.installations (
  id text not null primary key,
  name text not null,
  acronym text,
  location text,
  base_type text,
  command text,

  -- Units assigned under this installation
  unit_ids text[] not null default '{}'::text[],

  -- Installation sections (parallel to unit sections)
  sections text[] not null default '{}'::text[],

  -- Section assignments: { "section_name": ["user_id1", "user_id2"] }
  section_assignments jsonb not null default '{}'::jsonb,

  -- Installation commander (optional)
  commander_user_id text references public.users(user_id) on delete set null,

  -- Installation admins who can manage this installation
  insta_admin_user_ids text[] not null default '{}'::text[],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common lookups
create index if not exists idx_installations_name on public.installations using btree (name);
create index if not exists idx_installations_acronym on public.installations using btree (acronym);

-- Trigger to auto-update updated_at timestamp
create or replace function update_installations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_installations_updated_at
  before update on public.installations
  for each row
  execute function update_installations_updated_at();

-- Installation sections table (parallel to unit_sections)
create table if not exists public.installation_sections (
  id bigserial primary key,
  installation_id text not null references public.installations(id) on delete cascade,
  section_name text not null,
  display_name text,
  physical_location text,
  phone_number text,
  created_at timestamptz not null default now()
);

create index if not exists idx_installation_sections_installation_id
  on public.installation_sections using btree (installation_id);

-- Installation sub-tasks table (parallel to unit_sub_tasks)
-- These tasks are inherited by assigned units and cannot be removed
create table if not exists public.installation_sub_tasks (
  id bigserial primary key,
  installation_id text not null references public.installations(id) on delete cascade,
  section_id bigint not null references public.installation_sections(id) on delete cascade,
  sub_task_id text not null,
  description text not null,
  responsible_user_ids jsonb not null default '[]'::jsonb,
  location text,
  map_url text,
  instructions text,
  completion_kind text check (completion_kind in ('Text', 'Date', 'Options', 'Link')),
  completion_label text,
  completion_options jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_installation_sub_tasks_installation_id
  on public.installation_sub_tasks using btree (installation_id);
create index if not exists idx_installation_sub_tasks_section_id
  on public.installation_sub_tasks using btree (section_id);

-- Add installation_id to users table for civilians assigned directly to installation
alter table public.users add column if not exists installation_id text references public.installations(id) on delete set null;

-- Add is_insta_admin flag to users table
alter table public.users add column if not exists is_insta_admin boolean default false;

-- Add installation_id to units (via unit_admins or create units table reference)
-- For now, the relationship is managed via installations.unit_ids array

-- Disable RLS for now (matching existing pattern)
alter table public.installations disable row level security;
alter table public.installation_sections disable row level security;
alter table public.installation_sub_tasks disable row level security;
