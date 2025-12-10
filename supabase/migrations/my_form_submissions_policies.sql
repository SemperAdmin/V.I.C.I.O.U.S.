alter table if exists public.my_form_submissions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_form_submissions' and policyname = 'my_form_submissions_select_authenticated'
  ) then
    create policy my_form_submissions_select_authenticated
      on public.my_form_submissions
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_form_submissions' and policyname = 'my_form_submissions_insert_authenticated'
  ) then
    create policy my_form_submissions_insert_authenticated
      on public.my_form_submissions
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'my_form_submissions' and policyname = 'my_form_submissions_update_authenticated'
  ) then
    create policy my_form_submissions_update_authenticated
      on public.my_form_submissions
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
