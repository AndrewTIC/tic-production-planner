-- Tests for OT segmentation: each entry split into timestamped standard /
-- 1.5x / 2.0x portions. July dates are BST (UTC+1); timestamps are written
-- with +01 so the intent reads in local workshop time.
--
-- 2026-07-15 is a Wednesday, 2026-07-18 a Saturday, 2026-07-19 a Sunday.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- A plain standard day produces a single standard segment.
select results_eq(
  $$ select ot_class, minutes from public.time_entry_segments(
       '2026-07-15 07:30:00+01', '2026-07-15 16:00:00+01') $$,
  $$ values ('none'::text, 450) $$,
  'a full standard day is one standard segment of 7.5 hours');

-- The case that prompted this: working late splits the entry.
select results_eq(
  $$ select ot_class, minutes from public.time_entry_segments(
       '2026-07-15 07:30:00+01', '2026-07-15 18:00:00+01') $$,
  $$ values ('none'::text, 450), ('1.5'::text, 120) $$,
  'a 07:30-18:00 shift is 7.5h standard plus 2h at 1.5x, not 10.5h at 1.5x');

-- ...and the overtime carries its own timestamps, not just a total.
select results_eq(
  $$ select to_char(segment_start at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI'),
            to_char(segment_end   at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI')
       from public.time_entry_segments(
              '2026-07-15 07:30:00+01', '2026-07-15 18:00:00+01')
      where ot_class = '1.5' $$,
  $$ values ('2026-07-15 16:00'::text, '2026-07-15 18:00'::text) $$,
  'the overtime segment is stamped 16:00 to 18:00 on its own date');

-- An early start is overtime before the standard day opens.
select results_eq(
  $$ select ot_class, minutes from public.time_entry_segments(
       '2026-07-15 06:00:00+01', '2026-07-15 09:00:00+01') $$,
  $$ values ('1.5'::text, 90), ('none'::text, 90) $$,
  'an early start is 1.5x up to 07:30, then standard');

-- Saturday is all 1.5x, and still loses the break.
select results_eq(
  $$ select ot_class, minutes from public.time_entry_segments(
       '2026-07-18 08:00:00+01', '2026-07-18 16:00:00+01') $$,
  $$ values ('1.5'::text, 420) $$,
  'Saturday is 1.5x throughout, net of the unpaid break');

-- Sunday is all 2.0x.
select results_eq(
  $$ select ot_class, minutes from public.time_entry_segments(
       '2026-07-19 08:00:00+01', '2026-07-19 12:00:00+01') $$,
  $$ values ('2.0'::text, 240) $$,
  'Sunday is 2x throughout');

-- Crossing midnight from Friday into Saturday changes the class mid-entry.
select results_eq(
  $$ select ot_class,
            to_char(segment_start at time zone 'Europe/London', 'DD HH24:MI'),
            minutes
       from public.time_entry_segments(
              '2026-07-17 14:00:00+01', '2026-07-18 10:00:00+01') $$,
  $$ values ('none'::text, '17 14:00'::text, 120),
            ('1.5'::text,  '17 16:00'::text, 480),
            ('1.5'::text,  '18 00:00'::text, 600) $$,
  'an entry spanning midnight splits by day and by class');

-- The invariant that keeps the two derivations honest.
select is(
  (select sum(minutes)::int from public.time_entry_segments(
     '2026-07-15 07:30:00+01', '2026-07-15 18:00:00+01')),
  public.worked_minutes('2026-07-15 07:30:00+01', '2026-07-15 18:00:00+01'),
  'segment minutes always sum to the worked total');

-- Open entries produce nothing to collate yet.
select is_empty(
  $$ select * from public.time_entry_segments('2026-07-15 08:00:00+01', null) $$,
  'an open entry has no segments');

select * from finish();
rollback;
