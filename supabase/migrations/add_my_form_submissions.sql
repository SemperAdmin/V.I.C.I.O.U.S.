-- My form submissions table (currently uses localStorage via myFormSubmissionsStore.ts)
-- Stores actual form submission instances when users fill out forms
create table if not exists public.my_form_submissions (
  id bigserial primary key,
  user_id text not null,
  unit_id text not null,
  form_id bigint not null references public.unit_forms(id) on delete cascade,
  form_name text not null,
  kind text not null check (kind in ('Inbound', 'Outbound')),
  member jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Add indexes for faster lookups
create index if not exists idx_my_form_submissions_user_id on public.my_form_submissions(user_id);
create index if not exists idx_my_form_submissions_unit_id on public.my_form_submissions(unit_id);
create index if not exists idx_my_form_submissions_form_id on public.my_form_submissions(form_id);
create index if not exists idx_my_form_submissions_kind on public.my_form_submissions(kind);
create index if not exists idx_my_form_submissions_created_at on public.my_form_submissions(created_at desc);

-- Disable RLS for now (enable with policies later for production)
alter table public.my_form_submissions disable row level security;
