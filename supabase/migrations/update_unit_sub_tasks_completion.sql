alter table if exists public.unit_sub_tasks
  add column if not exists completion_kind text,
  add column if not exists completion_label text,
  add column if not exists completion_options jsonb not null default '[]'::jsonb;

alter table if exists public.unit_sub_tasks disable row level security;
