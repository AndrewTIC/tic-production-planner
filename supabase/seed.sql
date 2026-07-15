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
  ('a0000000-0000-0000-0000-000000000001', 'Andrew',          'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'Liam',            'admin'),
  ('a0000000-0000-0000-0000-000000000003', 'Sophie Clark',    'commercial'),
  ('a0000000-0000-0000-0000-000000000004', 'Workshop Kiosk',  'workshop'),
  ('a0000000-0000-0000-0000-000000000005', 'Richard Whalley', 'viewer')
on conflict (id) do update
  set display_name = excluded.display_name, role = excluded.role;

-- ── Workers (schedulable labour) ──────────────────────────────────
-- Andrew, Liam, and Sophie are users AND workers (spec §4); the three
-- workshop colleagues are workers only — they clock via the kiosk.
insert into workers (id, name, user_id) values
  ('b0000000-0000-0000-0000-000000000001', 'Andrew',         'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Liam',           'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', 'Sophie Clark',   'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000004', 'Kai Truscott',   null),
  ('b0000000-0000-0000-0000-000000000005', 'Dave Atkinson',  null),
  ('b0000000-0000-0000-0000-000000000006', 'Lewis Cuthbert', null)
on conflict (id) do nothing;

-- Dev-guess competencies — Commercial maintains the real ones in the UI.
-- Everyone gets Mechanical + Electrical; the managers also get Inspection.
insert into worker_phases (worker_id, phase_id)
select w.id, p.id
from workers w
cross join phases p
where w.id between 'b0000000-0000-0000-0000-000000000001'
               and 'b0000000-0000-0000-0000-000000000006'
  and (p.code in ('MECH','ELEC')
       or (p.code = 'INSP' and w.name in ('Andrew','Liam')))
on conflict do nothing;
