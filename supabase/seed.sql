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

-- ── Dev users (LOCAL ONLY — password for everyone: planner-dev) ───
-- Public signup is disabled, so local users are seeded directly. The
-- on_auth_user_created trigger provisions viewer profiles; the upsert below
-- then sets real names and roles. Production users will be created by an
-- admin screen via service_role, never by seed.
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change, email_change_token_new,
   created_at, updated_at)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, extensions.crypt('planner-dev', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  '', '', '', '',
  now(), now()
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'andrew@tic-direct.com',  'Andrew'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'liam@tic-direct.com',    'Liam'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'sophie@tic-direct.com',  'Sophie Clark'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'kiosk@tic-direct.com',   'Workshop Kiosk'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'richard@tic-direct.com', 'Richard Whalley')
) as u(id, email, display_name)
on conflict (id) do nothing;

-- GoTrue requires an identities row for email/password login.
insert into auth.identities
  (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.id between 'a0000000-0000-0000-0000-000000000001'
               and 'a0000000-0000-0000-0000-000000000005'
on conflict (provider_id, provider) do nothing;

-- Roles per spec §4. The kiosk is the shared shopfloor PC login: workshop
-- policies, with worker identity coming from the dropdown, not the login.
insert into profiles (id, display_name, role) values
  ('a0000000-0000-0000-0000-000000000001', 'Andrew Turner',   'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'Liam Chisholm',   'admin'),
  ('a0000000-0000-0000-0000-000000000003', 'Sophie Clark',    'commercial'),
  ('a0000000-0000-0000-0000-000000000004', 'Workshop Kiosk',  'workshop'),
  ('a0000000-0000-0000-0000-000000000005', 'Richard Whalley', 'viewer')
on conflict (id) do update
  set display_name = excluded.display_name, role = excluded.role;

-- ── Workers (schedulable labour) ──────────────────────────────────
-- Andrew, Liam, and Sophie are users AND workers (spec §4); the three
-- workshop colleagues are workers only — they clock via the kiosk.
insert into workers (id, name, user_id) values
  ('b0000000-0000-0000-0000-000000000001', 'Andrew Turner',  'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Liam Chisholm',  'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', 'Sophie Clark',   'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000004', 'Kai Truscott',   null),
  ('b0000000-0000-0000-0000-000000000005', 'Dave Atkinson',  null),
  ('b0000000-0000-0000-0000-000000000006', 'Lewis Cuthbert', null)
on conflict (id) do nothing;

-- Competencies (confirmed by Andrew, 17 Jul 2026): everyone does Mechanical
-- and Electrical; everyone except Dave can also inspect.
insert into worker_phases (worker_id, phase_id)
select w.id, p.id
from workers w
cross join phases p
where w.id between 'b0000000-0000-0000-0000-000000000001'
               and 'b0000000-0000-0000-0000-000000000006'
  and (p.code in ('MECH','ELEC')
       or (p.code = 'INSP'
           and w.name in ('Andrew Turner','Liam Chisholm','Sophie Clark','Kai Truscott','Lewis Cuthbert')))
on conflict do nothing;

-- ── Sample dev data (LOCAL ONLY) ──────────────────────────────────
-- A small deterministic dataset so `supabase db reset` yields a system
-- worth opening: registers populated, builds with operations, and an
-- outstanding material line. Production carries data over by pg_dump
-- restore, never by seed. Deterministic ids: c1=customers, c2=projects,
-- c3=parts, c4=builds, c5=operations, c6=material_items.
insert into customers (id, name, notes) values
  ('c1000000-0000-0000-0000-000000000001', 'Northern Water Systems',
   'Main contact: J. Barker. Orders usually via the Leeds office.')
on conflict (id) do nothing;

insert into projects (id, customer_id, name, notes) values
  ('c2000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'Leeds STW Upgrade 2026',
   'Framework order — panels called off in batches through 2026.')
on conflict (id) do nothing;

insert into parts (id, part_number, description) values
  ('c3000000-0000-0000-0000-000000000001', 'ESD-CP-0451',
   'Pump station control panel, 3-phase, IP65 enclosure'),
  ('c3000000-0000-0000-0000-000000000002', 'ESD-CP-0463',
   'Dosing rig control panel, single phase')
on conflict (id) do nothing;

insert into builds
  (id, bu_number, part_id, customer_id, project_id, order_number,
   order_received_date, requested_delivery_date,
   ow_sales_order_ref, ow_esd_sales_order_ref, status_id, priority)
values
  ('c4000000-0000-0000-0000-000000000001', 'BU12001',
   'c3000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'PO-88412', '2026-07-10', '2026-09-18', 'SO-104882', 'SO-104890',
   (select id from build_statuses where code = 'ORDER'), 'High'),
  ('c4000000-0000-0000-0000-000000000002', 'BU12002',
   'c3000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   null,
   'PO-88551', '2026-07-14', '2026-08-28', 'SO-104901', 'SO-104907',
   (select id from build_statuses where code = 'PART_PICKED'), 'Normal')
on conflict (id) do nothing;

-- Concurrent Mechanical + Electrical on BU12001 — the normal case (spec §6.2).
insert into operations (id, build_id, phase_id, description, estimated_hours) values
  ('c5000000-0000-0000-0000-000000000001',
   'c4000000-0000-0000-0000-000000000001',
   (select id from phases where code = 'MECH'),
   'Backplate and enclosure fit-out', 24),
  ('c5000000-0000-0000-0000-000000000002',
   'c4000000-0000-0000-0000-000000000001',
   (select id from phases where code = 'ELEC'),
   'Wiring and terminations', 32),
  ('c5000000-0000-0000-0000-000000000003',
   'c4000000-0000-0000-0000-000000000002',
   (select id from phases where code = 'MECH'),
   'Baseplate assembly', 8),
  ('c5000000-0000-0000-0000-000000000004',
   'c4000000-0000-0000-0000-000000000002',
   (select id from phases where code = 'INSP'),
   'Final inspection and test', 2)
on conflict (id) do nothing;

insert into material_items
  (id, build_id, component_part_number, description, expected_delivery_date)
values
  ('c6000000-0000-0000-0000-000000000001',
   'c4000000-0000-0000-0000-000000000001',
   'RITTAL-AX-1180', 'IP65 enclosure 800x1000x300', '2026-08-07')
on conflict (id) do nothing;

-- Holidays: one fixed closure plus a relative-date half day so the board
-- always has something to shade this week regardless of when it's reset.
insert into holidays (id, worker_id, date_from, date_to, part_of_day, note) values
  ('c7000000-0000-0000-0000-000000000001', null,
   '2026-12-24', '2027-01-01', 'full', 'Christmas shutdown'),
  ('c7000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000004',  -- Kai
   current_date + 2, current_date + 2, 'pm', 'Dentist (sample)')
on conflict (id) do nothing;

-- Sample assignments (relative dates) so the board renders cell chips and
-- the backlog shows partially-assigned operations immediately after reset.
insert into assignments (id, operation_id, worker_id, date, planned_hours, overtime) values
  ('c8000000-0000-0000-0000-000000000001',
   'c5000000-0000-0000-0000-000000000001',  -- BU12001 MECH
   'b0000000-0000-0000-0000-000000000004',  -- Kai
   current_date + 1, 7.5, false),
  ('c8000000-0000-0000-0000-000000000002',
   'c5000000-0000-0000-0000-000000000002',  -- BU12001 ELEC
   'b0000000-0000-0000-0000-000000000006',  -- Lewis
   current_date + 1, 4, false)
on conflict (id) do nothing;
