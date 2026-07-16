-- Tests for the holiday half-day constraint (0003 holiday_half_days migration).
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

-- Full-day ranges unaffected.
select lives_ok(
  $$ insert into holidays (worker_id, date_from, date_to, note)
     values (null, '2026-12-24', '2027-01-01', 'closure range') $$,
  'full-day range still inserts (part_of_day defaults to full)');

-- Half days are single-date rows.
select lives_ok(
  $$ insert into holidays (worker_id, date_from, date_to, part_of_day, note)
     values (null, '2026-07-24', '2026-07-24', 'pm', 'half day') $$,
  'pm half day on a single date inserts');

select throws_ok(
  $$ insert into holidays (worker_id, date_from, date_to, part_of_day)
     values (null, '2026-07-24', '2026-07-25', 'am') $$,
  '23514', null,
  'half day spanning more than one date is rejected');

select * from finish();
rollback;
