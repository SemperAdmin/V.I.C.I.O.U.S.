alter table if exists public.my_form_submissions
  add column if not exists arrival_date date,
  add column if not exists departure_date date;
