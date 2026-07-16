-- RLS policy tests for the core schema migration. Run with `supabase test db`
-- (pgTAP; everything rolls back at the end).
--
-- Pattern: create one auth user per role, then impersonate by switching to
-- the `authenticated` Postgres role with request.jwt.claims set — exactly
-- what PostgREST does — and assert what each role can and cannot do.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- ── Fixtures (as postgres, bypassing RLS) ─────────────────────────
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commercial@test.local'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kiosk@test.local'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@test.local');

-- The on_auth_user_created trigger (0002 migration) has already provisioned
-- viewer profiles for the users above; set the roles under test.
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-000000000001', 'Test Admin',      'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Test Commercial', 'commercial'),
  ('00000000-0000-0000-0000-000000000003', 'Workshop Kiosk',  'workshop'),
  ('00000000-0000-0000-0000-000000000004', 'Test Viewer',     'viewer')
on conflict (id) do update
  set display_name = excluded.display_name, role = excluded.role;

insert into public.customers (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Test Customer');
insert into public.parts (id, part_number)
values ('10000000-0000-0000-0000-000000000002', 'TEST-PART-001');
insert into public.builds (id, bu_number, part_id, customer_id, status_id)
values ('10000000-0000-0000-0000-000000000003', 'BU-TEST-001',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        (select id from public.build_statuses where code = 'ORDER'));
insert into public.operations (id, build_id, phase_id, estimated_hours)
values ('10000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000003',
        (select id from public.phases where code = 'MECH'), 10);
insert into public.workers (id, name)
values ('10000000-0000-0000-0000-000000000005', 'Test Worker');

-- Impersonation helper: set_config sticks for the transaction.
create or replace function test_login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end;
$$;
create or replace function test_logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', false);
end;
$$;

-- ── Viewer: read yes, write no ────────────────────────────────────
select test_login('00000000-0000-0000-0000-000000000004');

-- Count only the fixture build — seed data adds builds of its own.
select results_eq(
  $$ select count(*) from builds
     where id = '10000000-0000-0000-0000-000000000003' $$,
  array[1::bigint],
  'viewer can read builds');

select throws_ok(
  $$ insert into customers (name) values ('Viewer Customer') $$,
  '42501', null,
  'viewer cannot insert customers');

select throws_ok(
  $$ insert into notes (build_id, author_id, body) values
     ('10000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004', 'viewer note') $$,
  '42501', null,
  'viewer cannot add notes');

-- ── Commercial: operational writes yes, user management no ───────
select test_logout();
select test_login('00000000-0000-0000-0000-000000000002');

select lives_ok(
  $$ insert into customers (name) values ('Commercial Customer') $$,
  'commercial can insert customers');

select lives_ok(
  $$ update builds set materials_complete = true
     where id = '10000000-0000-0000-0000-000000000003' $$,
  'commercial can set materials_complete');

select throws_ok(
  $$ insert into time_entries (operation_id, worker_id, started_at) values
     ('10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005', now()) $$,
  '42501', null,
  'commercial cannot insert time entries (corrections are admin-only)');

-- No update policy for commercial on profiles: the row is invisible to the
-- update, which matches nothing rather than erroring.
select results_eq(
  $$ with upd as (
       update profiles set role = 'admin'
       where id = '00000000-0000-0000-0000-000000000002'
       returning 1)
     select count(*) from upd $$,
  array[0::bigint],
  'commercial cannot change roles');

-- ── Workshop (kiosk): clocking yes, build editing no ─────────────
select test_logout();
select test_login('00000000-0000-0000-0000-000000000003');

-- 08:00 UTC on Wed 15 Jul 2026 = 09:00 London (BST): inside the standard day.
select lives_ok(
  $$ insert into time_entries (id, operation_id, worker_id, started_at) values
     ('20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005',
      '2026-07-15 08:00:00+00') $$,
  'workshop can clock on');

select results_eq(
  $$ select ot_class from time_entries
     where id = '20000000-0000-0000-0000-000000000001' $$,
  array['none'::text],
  'in-hours weekday entry derives ot_class none');

-- The entry is still open here, so the update policy allows the row and the
-- refusal comes from the void guard trigger, not from row filtering.
select throws_ok(
  $$ update time_entries set voided = true
     where id = '20000000-0000-0000-0000-000000000001' $$,
  'P0001', 'only admin may void or restore a time entry',
  'workshop cannot void a time entry');

select lives_ok(
  $$ update time_entries set ended_at = '2026-07-15 14:00:00+00'
     where id = '20000000-0000-0000-0000-000000000001' $$,
  'workshop can clock off an open entry');

-- The update policy's USING clause hides closed entries from workshop, so
-- the update silently matches nothing rather than erroring.
select results_eq(
  $$ with upd as (
       update time_entries set ended_at = '2026-07-15 15:00:00+00'
       where id = '20000000-0000-0000-0000-000000000001'
       returning 1)
     select count(*) from upd $$,
  array[0::bigint],
  'workshop cannot re-edit a closed entry');

select lives_ok(
  $$ update operations set blocked = true, blocked_reason = 'awaiting enclosure'
     where id = '10000000-0000-0000-0000-000000000004' $$,
  'workshop can flag an operation blocked');

select throws_ok(
  $$ update operations set estimated_hours = 99
     where id = '10000000-0000-0000-0000-000000000004' $$,
  'P0001', 'workshop role may only change blocked / blocked_reason',
  'workshop cannot change estimated hours');

-- ── Admin: corrections are audited, deletes impossible ───────────
select test_logout();
select test_login('00000000-0000-0000-0000-000000000001');

select lives_ok(
  $$ update time_entries set ended_at = '2026-07-15 15:30:00+00'
     where id = '20000000-0000-0000-0000-000000000001' $$,
  'admin can correct a closed time entry');

select results_eq(
  $$ select original_values->>'ended_at' is not null,
            adjusted_by = '00000000-0000-0000-0000-000000000001'
     from time_entries
     where id = '20000000-0000-0000-0000-000000000001' $$,
  $$ values (true, true) $$,
  'correction retained original values and recorded who');

-- RLS silently filters deletes it does not permit: row must survive.
select results_eq(
  $$ with del as (
       delete from time_entries
       where id = '20000000-0000-0000-0000-000000000001'
       returning 1)
     select count(*) from del $$,
  array[0::bigint],
  'time entries cannot be hard-deleted, even by admin');

-- Admin delete = soft-delete (void): values retained, who/when stamped,
-- entry drops out of active_time_entries (what all totals/screens read).
select lives_ok(
  $$ update time_entries set voided = true
     where id = '20000000-0000-0000-0000-000000000001' $$,
  'admin can void a time entry');

select results_eq(
  $$ select voided,
            voided_by = '00000000-0000-0000-0000-000000000001',
            voided_at is not null,
            started_at is not null
     from time_entries
     where id = '20000000-0000-0000-0000-000000000001' $$,
  $$ values (true, true, true, true) $$,
  'void stamped who/when and retained the entry values');

select results_eq(
  $$ select count(*) from active_time_entries
     where id = '20000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'voided entry is excluded from active_time_entries');

select test_logout();
select * from finish();
rollback;
