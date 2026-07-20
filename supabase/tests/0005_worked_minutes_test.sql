-- Tests for worked_minutes: elapsed less the unpaid 12:00-13:00 break.
-- July dates are BST (UTC+1), so timestamps are written with +01 to keep
-- the intent readable.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- The case that prompted this: a standard full day.
select is(
  public.worked_minutes('2026-07-15 07:30:00+01', '2026-07-15 16:00:00+01'),
  450,
  'a full standard day is 7.5 hours worked, not the 8.5 on the clock');

-- Morning only — never touches the break.
select is(
  public.worked_minutes('2026-07-15 09:00:00+01', '2026-07-15 11:00:00+01'),
  120,
  'an entry finishing before noon loses nothing');

-- Afternoon only — starts after the break.
select is(
  public.worked_minutes('2026-07-15 13:00:00+01', '2026-07-15 16:00:00+01'),
  180,
  'an entry starting at 13:00 loses nothing');

-- Half in the break.
select is(
  public.worked_minutes('2026-07-15 12:30:00+01', '2026-07-15 13:30:00+01'),
  30,
  'only the part inside the break window is deducted');

-- Entirely inside the break — someone clocked on over lunch.
select is(
  public.worked_minutes('2026-07-15 12:10:00+01', '2026-07-15 12:40:00+01'),
  0,
  'an entry wholly inside the break is worth nothing');

-- Two days: an overnight admin correction crosses one break each day.
select is(
  public.worked_minutes('2026-07-15 08:00:00+01', '2026-07-16 16:00:00+01'),
  1800,
  'a multi-day entry deducts one break per day it spans');

-- A late shift after the standard day: no break involved.
select is(
  public.worked_minutes('2026-07-15 16:00:00+01', '2026-07-15 18:30:00+01'),
  150,
  'evening overtime is unaffected by the lunch break');

-- Open entries have no worked total yet.
select is(
  public.worked_minutes('2026-07-15 08:00:00+01', null),
  null,
  'an open entry has no worked total');

select * from finish();
rollback;
