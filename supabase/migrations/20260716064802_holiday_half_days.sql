-- Half-day holidays: AM or PM absence on a single date.
--
-- Model: a holiday row is either a range of FULL days (part_of_day = 'full',
-- date_from..date_to) or a single half day (part_of_day = 'am'/'pm',
-- date_from = date_to enforced below). "Thursday PM through Monday AM" is
-- therefore recorded as three rows (pm half, full range, am half) — keeping
-- half-day information per-date makes the capacity model unambiguous.
--
-- Capacity note for Phase 2: the two halves are NOT equal. Against the
-- standard day (07:30–16:00, break 12:00–13:00), an AM absence removes the
-- 4.5 productive hours before the break; a PM absence removes the 3.0 after.
alter table holidays
  add column part_of_day text not null default 'full'
    check (part_of_day in ('full', 'am', 'pm'));

alter table holidays
  add constraint holidays_half_day_single_date
    check (part_of_day = 'full' or date_from = date_to);
