alter table if exists public.unit_sub_tasks
  add column if not exists map_url text;
