-- Users table
create table if not exists public.users (
  user_id text primary key,
  edipi text unique not null,
  mos text not null,
  first_name text,
  middle_initial text,
  last_name text,
  branch text,
  rank text,
  org_role text not null,
  unit_id text not null,
  company_id text,
  platoon_id text,
  hashed_password text not null,
  created_at_timestamp timestamptz not null,
  updated_at_timestamp timestamptz not null
);

-- Member progress table
create table if not exists public.members_progress (
  member_user_id text primary key,
  unit_id text not null,
  official_checkin_timestamp timestamptz not null,
  current_file_sha text,
  progress_tasks jsonb not null default '[]'::jsonb
);

-- Dev: disable RLS for quick local testing (enable and add policies later)
alter table public.users disable row level security;
alter table public.members_progress disable row level security;

