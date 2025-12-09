create table if not exists public.unit_sections (
  id bigserial primary key,
  unit_id text not null,
  section_name text not null,
  prerequisite_item_id text,
  physical_location text,
  phone_number text
);

create table if not exists public.unit_sub_tasks (
  id bigserial primary key,
  unit_id text not null,
  section_id bigint not null references public.unit_sections(id) on delete cascade,
  sub_task_id text not null,
  description text not null,
  responsible_user_ids jsonb not null default '[]'::jsonb
);

alter table public.unit_sections disable row level security;
alter table public.unit_sub_tasks disable row level security;

