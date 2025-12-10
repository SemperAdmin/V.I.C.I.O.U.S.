-- Ensure each form instance is unique by member, unit, template, and creation time
create unique index if not exists uniq_form_instance
  on public.my_form_submissions (user_id, unit_id, form_id, created_at);
