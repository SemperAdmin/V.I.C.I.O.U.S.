alter table if exists public.my_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_items' and policyname = 'my_items_select_authenticated'
  ) then
    create policy my_items_select_authenticated
      on public.my_items
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_items' and policyname = 'my_items_insert_authenticated'
  ) then
    create policy my_items_insert_authenticated
      on public.my_items
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_items' and policyname = 'my_items_update_authenticated'
  ) then
    create policy my_items_update_authenticated
      on public.my_items
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
