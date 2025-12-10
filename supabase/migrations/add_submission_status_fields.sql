alter table if exists public.my_form_submissions
  add column if not exists status text,
  add column if not exists completed_at timestamptz,
  add column if not exists total_count int,
  add column if not exists completed_count int,
  add column if not exists task_ids jsonb;
