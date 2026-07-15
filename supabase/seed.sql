-- ESD Production Planner — reference/seed data.
-- Runs on every `supabase db reset`, after all migrations. Must leave a
-- working system. Idempotent (on conflict do nothing) so it is safe to
-- re-run against an existing database.

-- Labour phases (spec §6.2): Mechanical and Electrical run concurrently as a
-- matter of course; no sequencing lives here.
insert into phases (code, name) values
  ('MECH', 'Mechanical'),
  ('ELEC', 'Electrical'),
  ('INSP', 'Inspection')
on conflict (code) do nothing;

-- Build statuses (spec §6.2) — reference data, extensible without code
-- changes. `clockable` drives the shopfloor BU dropdown filter: clocking is
-- possible from Order onwards (In-Build is set automatically at first
-- clock-on, so earlier statuses must be clockable); On-hold and Ready for
-- despatch are not clockable.
insert into build_statuses (code, name, sequence, clockable) values
  ('ORDER',          'Order',               10, true),
  ('PART_PICKED',    'Part-Picked',         20, true),
  ('PICKED',         'Picked',              30, true),
  ('IN_BUILD',       'In-Build',            40, true),
  ('ON_HOLD',        'On-hold',             50, false),
  ('READY_DESPATCH', 'Ready for despatch',  60, false)
on conflict (code) do nothing;

-- Users/profiles (Andrew, Liam, Sophie, kiosk), user-linked workers, and
-- sample customers/parts/builds are deliberately NOT seeded yet: they need
-- auth.users rows, which arrive with the Auth work in Phase 1.
