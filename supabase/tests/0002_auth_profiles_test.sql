-- Tests for the auth provisioning trigger (0002 auth_profiles migration).
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

-- Creating an auth user provisions a profile automatically...
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'newstarter@test.local', '{"display_name":"New Starter"}');

select results_eq(
  $$ select display_name, role from profiles
     where id = '30000000-0000-0000-0000-000000000001' $$,
  $$ values ('New Starter'::text, 'viewer'::text) $$,
  'new auth user gets a profile with metadata name and viewer role');

-- ...as least-privilege viewer even if metadata claims otherwise (role is
-- never read from metadata — that would be client-suppliable).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'chancer@test.local', '{"display_name":"Chancer","role":"admin"}');

select results_eq(
  $$ select role from profiles
     where id = '30000000-0000-0000-0000-000000000002' $$,
  array['viewer'::text],
  'role in signup metadata is ignored — always provisioned as viewer');

-- Missing display_name falls back to the email.
insert into auth.users (id, instance_id, aud, role, email)
values ('30000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'anon.name@test.local');

select results_eq(
  $$ select display_name from profiles
     where id = '30000000-0000-0000-0000-000000000003' $$,
  array['anon.name@test.local'::text],
  'display_name falls back to email when metadata has none');

select * from finish();
rollback;
