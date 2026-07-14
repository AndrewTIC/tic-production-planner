-- ESD Production Planner — first migration OUTLINE (v0.4 data model)
-- Working draft to hand to Claude Code as the starting point for
-- `supabase migration new core_schema`. Review before applying.
-- Conventions: uuid PKs, created_at/updated_at everywhere,
-- business_unit on transactional tables, RLS enabled on every table.

-- ── Reference data ────────────────────────────────────────────────
create table phases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- MECH, ELEC, INSP
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table build_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- ORDER, PART_PICKED, PICKED, IN_BUILD, ON_HOLD, READY_DESPATCH
  name text not null,
  sequence int not null,
  clockable boolean not null default false,  -- filters shopfloor BU dropdown
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── People ────────────────────────────────────────────────────────
create table profiles (                -- 1:1 with auth.users; system users
  id uuid primary key references auth.users(id),
  display_name text not null,
  role text not null check (role in ('admin','commercial','workshop','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workers (                 -- schedulable labour; may link to a user
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  user_id uuid references auth.users(id),  -- nullable: Andrew/Liam/Sophie are both
  standard_day jsonb not null default
    '{"start":"07:30","end":"16:00","break_start":"12:00","break_end":"13:00","hours":7.5,"days":["Mon","Tue","Wed","Thu","Fri"]}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table worker_phases (
  worker_id uuid not null references workers(id),
  phase_id uuid not null references phases(id),
  primary key (worker_id, phase_id)
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id),   -- null = company-wide closure
  date_from date not null,
  date_to date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Commercial structure ──────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table parts (                   -- ESD-built assemblies only
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Builds ────────────────────────────────────────────────────────
create table builds (
  id uuid primary key default gen_random_uuid(),
  bu_number text not null unique,
  part_id uuid not null references parts(id),
  customer_id uuid not null references customers(id),   -- ALWAYS external customer
  project_id uuid references projects(id),               -- optional grouping
  order_number text,
  order_received_date date,
  requested_delivery_date date,
  ow_sales_order_ref text,        -- OrderWise SO (single line, part number)
  ow_esd_sales_order_ref text,    -- internal ESD OrderWise SO (full build BOM)
  status_id uuid not null references build_statuses(id),
  priority text not null default 'Normal'
    check (priority in ('Low','Normal','High','Urgent')),
  materials_complete boolean not null default false,     -- manual, set by Commercial
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table material_items (          -- outstanding bought-in components
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id),
  component_part_number text not null,  -- FREE TEXT: not the ESD parts register
  description text,
  expected_delivery_date date,
  booked_in boolean not null default false,
  booked_in_date date,
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table operations (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id),
  phase_id uuid not null references phases(id),
  description text,
  estimated_hours numeric(6,2) not null default 0,
  status text not null default 'Pending',
  blocked boolean not null default false,
  blocked_reason text,
  depends_on uuid references operations(id),  -- optional only; no default sequencing
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Scheduling & time ─────────────────────────────────────────────
create table assignments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations(id),
  worker_id uuid not null references workers(id),
  date date not null,
  planned_hours numeric(4,2) not null,
  overtime boolean not null default false,   -- explicitly scheduled OT
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations(id),
  worker_id uuid not null references workers(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  -- OT class derived from timestamps: none | 1.5 (Mon–Sat outside 07:30–16:00) | 2.0 (Sun).
  -- Implement as a generated column or trigger — never user-entered.
  ot_class text not null default 'none' check (ot_class in ('none','1.5','2.0')),
  auto_closed boolean not null default false, -- end-of-shift auto clock-off, flag for review
  adjusted_by uuid references auth.users(id), -- Admin corrections only
  adjusted_at timestamptz,
  original_values jsonb,                      -- pre-correction values retained
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Notes & documents ─────────────────────────────────────────────
create table notes (                    -- append-only activity log
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id),
  author_id uuid not null references auth.users(id),
  body text not null,
  hidden boolean not null default false,  -- Admin hide, never delete
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references builds(id),
  note_id uuid references notes(id),      -- set when attached via a note (red-pens, photos)
  filename text not null,
  storage_path text not null,             -- Supabase Storage bucket 'build-documents'
  file_type text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id),
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Still to write in this migration ──────────────────────────────
-- 1. alter table ... enable row level security;  ← EVERY table
-- 2. RLS policies per role (admin / commercial / workshop / viewer) —
--    workshop: read builds/operations/assignments, insert time_entries & notes,
--    update operations.blocked; kiosk user identity note: worker_id from the
--    dropdown, not auth.uid().
-- 3. updated_at trigger function applied to all tables.
-- 4. ot_class derivation (trigger on time_entries insert/update of ended_at).
-- 5. Storage bucket 'build-documents' + storage policies mirroring documents RLS.
-- 6. Seed (in supabase/seed.sql): phases, build_statuses (with clockable flags),
--    workers incl. Andrew/Liam/Sophie linked to users, sample customers/parts/builds.
