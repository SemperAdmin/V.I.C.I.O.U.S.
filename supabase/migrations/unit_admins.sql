create table if not exists public.unit_admins (
  unit_key text primary key,
  unit_name text not null,
  admin_user_id text not null,
  created_at timestamptz not null default now()
);

alter table public.unit_admins disable row level security;

