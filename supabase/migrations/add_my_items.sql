-- My items table (currently uses localStorage via myItemsStore.ts)
-- Stores user's personal inbound/outbound items
create table if not exists public.my_items (
  id bigserial primary key,
  user_id text not null,
  name text not null,
  kind text not null check (kind in ('Inbound', 'Outbound')),
  form_id bigint references public.unit_forms(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Add indexes for faster lookups
create index if not exists idx_my_items_user_id on public.my_items(user_id);
create index if not exists idx_my_items_kind on public.my_items(kind);
create index if not exists idx_my_items_form_id on public.my_items(form_id);

-- Disable RLS for now (enable with policies later for production)
alter table public.my_items disable row level security;
