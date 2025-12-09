-- Create tables to persist unit forms, user items, and user form submissions
create table if not exists public.unit_forms (
  id bigserial primary key,
  unit_id text not null,
  name text not null,
  kind text not null check (kind in ('Inbound','Outbound')),
  task_ids jsonb not null default '[]'::jsonb,
  purpose text,
  unique (unit_id, name)
);

create index if not exists unit_forms_unit_id_idx on public.unit_forms (unit_id);

create table if not exists public.my_items (
  id bigserial primary key,
  user_id text not null,
  name text not null,
  kind text not null check (kind in ('Inbound','Outbound')),
  form_id bigint references public.unit_forms(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists my_items_user_id_idx on public.my_items (user_id);

create table if not exists public.my_form_submissions (
  id bigserial primary key,
  user_id text not null,
  unit_id text not null,
  form_id bigint references public.unit_forms(id) on delete set null,
  form_name text not null,
  kind text not null check (kind in ('Inbound','Outbound')),
  created_at timestamptz not null default now(),
  member jsonb not null,
  tasks jsonb not null default '[]'::jsonb
);

create index if not exists my_form_submissions_user_id_idx on public.my_form_submissions (user_id);
create index if not exists my_form_submissions_unit_id_idx on public.my_form_submissions (unit_id);
