-- Tests for the shopfloor clocking migration (0004).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Fixtures: a build at Order with one operation, plus a worker.
insert into customers (id, name) values
  ('40000000-0000-0000-0000-000000000001', 'Clocking Test Co');
insert into parts (id, part_number) values
  ('40000000-0000-0000-0000-000000000002', 'CLOCK-TEST-1');
insert into builds (id, bu_number, part_id, customer_id, status_id)
values ('40000000-0000-0000-0000-000000000003', 'BU-CLOCK-1',
        '40000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000001',
        (select id from build_statuses where code = 'ORDER'));
insert into operations (id, build_id, phase_id, estimated_hours)
values ('40000000-0000-0000-0000-000000000004',
        '40000000-0000-0000-0000-000000000003',
        (select id from phases where code = 'MECH'), 10);
insert into workers (id, name) values
  ('40000000-0000-0000-0000-000000000005', 'Clocking Test Worker');

-- ── In-Build on first clock-on ────────────────────────────────────
insert into time_entries (id, operation_id, worker_id, started_at)
values ('41000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000004',
        '40000000-0000-0000-0000-000000000005',
        '2026-07-15 08:00:00+00');

select results_eq(
  $$ select s.code from builds b join build_statuses s on s.id = b.status_id
     where b.id = '40000000-0000-0000-0000-000000000003' $$,
  array['IN_BUILD'::text],
  'first clock-on moves the build from Order to In-Build');

-- A build parked later in the sequence is NOT dragged backwards.
update builds set status_id = (select id from build_statuses where code = 'ON_HOLD')
 where id = '40000000-0000-0000-0000-000000000003';

insert into time_entries (id, operation_id, worker_id, started_at)
values ('41000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000004',
        '40000000-0000-0000-0000-000000000005',
        '2026-07-16 08:00:00+00');

select results_eq(
  $$ select s.code from builds b join build_statuses s on s.id = b.status_id
     where b.id = '40000000-0000-0000-0000-000000000003' $$,
  array['ON_HOLD'::text],
  'clock-on never drags a later status back to In-Build');

-- ── Auto clock-off ────────────────────────────────────────────────
-- Both entries above are still open and started before 16:00 on their day.
select is(
  public.auto_close_open_time_entries('2026-07-20 00:00:00+00'),
  2,
  'auto close returns the number of entries it closed');

select results_eq(
  $$ select count(*)::int from time_entries
     where id in ('41000000-0000-0000-0000-000000000001',
                  '41000000-0000-0000-0000-000000000002')
       and ended_at is not null and auto_closed $$,
  array[2],
  'closed entries are stamped auto_closed for review');

-- Closed at 16:00 London on the entry's OWN date, not at the run time.
select results_eq(
  $$ select to_char(ended_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI')
     from time_entries where id = '41000000-0000-0000-0000-000000000001' $$,
  array['2026-07-15 16:00'::text],
  'auto close uses end of the standard day the entry started on');

-- An entry started today, before its shift end, is left alone.
insert into time_entries (id, operation_id, worker_id, started_at)
values ('41000000-0000-0000-0000-000000000003',
        '40000000-0000-0000-0000-000000000004',
        '40000000-0000-0000-0000-000000000005',
        '2026-07-21 08:00:00+00');

select results_eq(
  $$ select ended_at is null from time_entries
     where id = '41000000-0000-0000-0000-000000000003' $$,
  array[true],
  'an entry whose shift has not ended yet stays open');

select * from finish();
rollback;
