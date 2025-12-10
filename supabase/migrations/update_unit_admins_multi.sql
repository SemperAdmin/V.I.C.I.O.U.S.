-- Allow multiple admins per unit by making (unit_key, admin_user_id) the primary key
alter table if exists public.unit_admins drop constraint if exists unit_admins_pkey;
alter table if exists public.unit_admins add constraint unit_admins_pkey primary key (unit_key, admin_user_id);
