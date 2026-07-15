-- Auth provisioning (Phase 1): every auth user gets a profiles row.
--
-- Users are Admin-managed (spec §4: user and role management is an Admin
-- capability) — public signup is disabled in supabase/config.toml. New users
-- are therefore created by an admin (Studio locally; a service-role admin
-- screen later), and this trigger provisions their profile automatically.
--
-- New profiles always start as 'viewer' (least privilege). The role is never
-- taken from user metadata: metadata is client-suppliable at signup, which
-- would let anyone mint themselves an admin profile. Admins promote via the
-- profiles table, which only they can update (RLS, core_schema migration).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), new.email, 'New user'),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
