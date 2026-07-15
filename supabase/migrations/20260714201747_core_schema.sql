-- ESD Production Planner — core schema (spec v0.4 data model)
-- Conventions: uuid PKs, created_at/updated_at everywhere, business_unit on
-- transactional tables, RLS enabled on every table.
-- Reference data (phases, build_statuses) is seeded in supabase/seed.sql.

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

create table worker_phases (           -- phase competency, many-to-many
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
  check (date_to >= date_from),
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
  customer_id uuid not null references customers(id),   -- ALWAYS an external customer
  project_id uuid references projects(id),               -- optional grouping
  order_number text,
  order_received_date date,
  requested_delivery_date date,
  ow_sales_order_ref text,        -- OrderWise SO (single line, part number)
  ow_esd_sales_order_ref text,    -- internal ESD OrderWise SO (full build BOM)
  status_id uuid not null references build_statuses(id),
  priority text not null default 'Normal'
    check (priority in ('Low','Normal','High','Urgent')),
  materials_complete boolean not null default false,     -- manual, set by Commercial; informational only
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
  planned_hours numeric(4,2) not null check (planned_hours > 0),
  overtime boolean not null default false,   -- explicitly scheduled OT
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations(id),
  worker_id uuid not null references workers(id),   -- identity from the kiosk dropdown, not auth.uid()
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at),
  -- Derived by trigger from started_at/ended_at — never user-entered.
  ot_class text not null default 'none' check (ot_class in ('none','1.5','2.0')),
  auto_closed boolean not null default false, -- end-of-shift auto clock-off, flag for review
  adjusted_by uuid references auth.users(id), -- Admin corrections only
  adjusted_at timestamptz,
  original_values jsonb,                      -- pre-correction values retained
  -- Admin "delete" is a soft-delete (spec §6.6): the row keeps its values and
  -- is excluded from all totals and screens except the Admin audit view.
  voided boolean not null default false,
  voided_by uuid references auth.users(id),
  voided_at timestamptz,
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
  storage_path text not null,             -- Supabase Storage bucket 'build-documents' (bucket in a later migration)
  file_type text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id),
  business_unit text not null default 'ESD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────
-- Postgres does not index FK columns automatically; these cover the joins
-- every screen makes (build detail, board, reports).
create index idx_projects_customer on projects (customer_id);
create index idx_builds_part on builds (part_id);
create index idx_builds_customer on builds (customer_id);
create index idx_builds_project on builds (project_id);
create index idx_builds_status on builds (status_id);
create index idx_material_items_build on material_items (build_id);
create index idx_operations_build on operations (build_id);
create index idx_operations_phase on operations (phase_id);
create index idx_assignments_operation on assignments (operation_id);
create index idx_assignments_worker_date on assignments (worker_id, date);
create index idx_time_entries_operation on time_entries (operation_id);
create index idx_time_entries_worker_started on time_entries (worker_id, started_at);
create index idx_holidays_worker on holidays (worker_id);
create index idx_notes_build on notes (build_id);
create index idx_documents_build on documents (build_id);
create index idx_documents_note on documents (note_id);

-- ══ Row Level Security ════════════════════════════════════════════
-- Roles (profiles.role): admin > commercial > workshop > viewer.
-- The shared shopfloor PC signs in as a dedicated kiosk auth user with the
-- 'workshop' role; worker identity on a time entry comes from the selected
-- worker_id, never from auth.uid().

alter table phases          enable row level security;
alter table build_statuses  enable row level security;
alter table profiles        enable row level security;
alter table workers         enable row level security;
alter table worker_phases   enable row level security;
alter table holidays        enable row level security;
alter table customers       enable row level security;
alter table projects        enable row level security;
alter table parts           enable row level security;
alter table builds          enable row level security;
alter table material_items  enable row level security;
alter table operations      enable row level security;
alter table assignments     enable row level security;
alter table time_entries    enable row level security;
alter table notes           enable row level security;
alter table documents       enable row level security;

-- Table privileges: newer Supabase no longer auto-grants API roles access to
-- new tables, so grant explicitly. `authenticated` gets CRUD — RLS policies
-- below decide what each signed-in user can actually touch (tables without a
-- delete policy, like time_entries and notes, still refuse deletes). `anon`
-- gets nothing: every screen requires a login, including the shopfloor kiosk.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- service_role is the server-side key (admin scripts, user provisioning);
-- it bypasses RLS by design but still needs table privileges.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;

-- Role of the signed-in user. SECURITY DEFINER so it can read profiles
-- without tripping profiles' own RLS (avoids infinite recursion); the empty
-- search_path forces fully-qualified names inside, a definer-function hygiene rule.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

-- Policies below wrap app_role() in (select ...) so Postgres evaluates it
-- once per statement (InitPlan) instead of once per row.

-- Reference data: everyone signed-in reads; only admin maintains.
create policy "phases read" on phases
  for select to authenticated using (true);
create policy "phases admin write" on phases
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

create policy "build_statuses read" on build_statuses
  for select to authenticated using (true);
create policy "build_statuses admin write" on build_statuses
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Profiles: readable by all signed-in users (note authors, correction
-- trails need display names); only admin manages users and roles.
create policy "profiles read" on profiles
  for select to authenticated using (true);
create policy "profiles admin write" on profiles
  for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Workers, competencies, holidays: Commercial manages workers and calendars.
create policy "workers read" on workers
  for select to authenticated using (true);
create policy "workers write" on workers
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "worker_phases read" on worker_phases
  for select to authenticated using (true);
create policy "worker_phases write" on worker_phases
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "holidays read" on holidays
  for select to authenticated using (true);
create policy "holidays write" on holidays
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

-- Commercial structure and builds: everyone reads (workshop sees builds,
-- viewer sees schedule/reports); admin + commercial write.
create policy "customers read" on customers
  for select to authenticated using (true);
create policy "customers write" on customers
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "projects read" on projects
  for select to authenticated using (true);
create policy "projects write" on projects
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "parts read" on parts
  for select to authenticated using (true);
create policy "parts write" on parts
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "builds read" on builds
  for select to authenticated using (true);
create policy "builds write" on builds
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

create policy "material_items read" on material_items
  for select to authenticated using (true);
create policy "material_items write" on material_items
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

-- Operations: admin/commercial full write; workshop may update too, but a
-- trigger below limits workshop changes to blocked / blocked_reason.
create policy "operations read" on operations
  for select to authenticated using (true);
create policy "operations write" on operations
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));
create policy "operations workshop block flag" on operations
  for update to authenticated
  using ((select public.app_role()) = 'workshop')
  with check ((select public.app_role()) = 'workshop');

create policy "assignments read" on assignments
  for select to authenticated using (true);
create policy "assignments write" on assignments
  for all to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));

-- Time entries: readable by all signed-in roles (utilisation reports are
-- viewer-visible). Workshop clocks on (insert) and clocks off (update, but
-- only while an entry is still open). Admin has insert/update for
-- corrections — audited by trigger below. NO delete policy exists, so
-- hard deletes are impossible for every role: admin "delete" is a
-- soft-delete via the voided flag (admin-only, enforced by trigger below),
-- and corrections are edits-in-place with original_values retained.
create policy "time_entries read" on time_entries
  for select to authenticated using (true);
create policy "time_entries insert" on time_entries
  for insert to authenticated
  with check ((select public.app_role()) in ('admin','workshop'));
create policy "time_entries workshop clock off" on time_entries
  for update to authenticated
  using ((select public.app_role()) = 'workshop' and ended_at is null)
  with check ((select public.app_role()) = 'workshop');
create policy "time_entries admin correct" on time_entries
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Notes: append-only. All roles except viewer write; author is always the
-- signed-in user (on the kiosk that is the kiosk user — the note text says
-- who). Admin may update (a trigger limits updates to `hidden`). No deletes.
create policy "notes read" on notes
  for select to authenticated using (true);
create policy "notes insert" on notes
  for insert to authenticated
  with check (
    (select public.app_role()) in ('admin','commercial','workshop')
    and author_id = (select auth.uid())
  );
create policy "notes admin hide" on notes
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Documents: everyone views/downloads; admin/commercial manage; workshop may
-- upload only as an attachment to a note (red-pen markups, photos).
create policy "documents read" on documents
  for select to authenticated using (true);
create policy "documents insert" on documents
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (
      (select public.app_role()) in ('admin','commercial')
      or ((select public.app_role()) = 'workshop' and note_id is not null)
    )
  );
create policy "documents manage" on documents
  for update to authenticated
  using ((select public.app_role()) in ('admin','commercial'))
  with check ((select public.app_role()) in ('admin','commercial'));
create policy "documents delete" on documents
  for delete to authenticated
  using ((select public.app_role()) in ('admin','commercial'));

-- ══ updated_at maintenance ════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Every table with an updated_at column (worker_phases carries no timestamps).
do $$
declare t text;
begin
  foreach t in array array[
    'phases','build_statuses','profiles','workers','holidays',
    'customers','projects','parts','builds','material_items',
    'operations','assignments','time_entries','notes','documents'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ══ Overtime classification ═══════════════════════════════════════
-- Standard day 07:30–16:00 Mon–Fri (spec §6.4). Sunday work is 2x; Saturday
-- or Mon–Fri work outside the standard window is 1.5x. Derived on every
-- insert/update so it can never be user-entered; times are evaluated in
-- Europe/London (timestamps are stored UTC). An entry is classed by its
-- start day; if any part of it falls outside the standard window it is OT —
-- the auto end-of-shift clock-off keeps entries from straddling the boundary
-- in normal use.
create or replace function public.derive_ot_class()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_start timestamp := new.started_at at time zone 'Europe/London';
  local_end   timestamp := new.ended_at   at time zone 'Europe/London';
  dow int := extract(isodow from local_start);  -- 1 = Mon … 7 = Sun
begin
  if dow = 7 then
    new.ot_class := '2.0';
  elsif dow = 6
     or local_start::time < time '07:30'
     or local_start::time >= time '16:00'
     or (local_end is not null
         and (local_end::time > time '16:00' or local_end::date <> local_start::date))
  then
    new.ot_class := '1.5';
  else
    new.ot_class := 'none';
  end if;
  return new;
end;
$$;

create trigger derive_ot_class
  before insert or update on time_entries
  for each row execute function public.derive_ot_class();

-- ══ Correction audit (CLAUDE.md rule 6) ═══════════════════════════
-- Any change to a time entry's substance keeps the original values (first
-- correction only — the true original survives later corrections) and
-- records who and when. A workshop clock-off (filling in ended_at on an open
-- entry) is normal operation, not a correction.
create or replace function public.audit_time_entry_correction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- original_values is written once by this trigger and never cleared.
  if old.original_values is not null then
    new.original_values := old.original_values;
  end if;

  if old.started_at is distinct from new.started_at
     or old.operation_id is distinct from new.operation_id
     or old.worker_id is distinct from new.worker_id
     or (old.ended_at is not null and old.ended_at is distinct from new.ended_at)
  then
    if new.original_values is null then
      new.original_values := jsonb_build_object(
        'operation_id', old.operation_id,
        'worker_id',    old.worker_id,
        'started_at',   old.started_at,
        'ended_at',     old.ended_at,
        'ot_class',     old.ot_class,
        'auto_closed',  old.auto_closed
      );
    end if;
    new.adjusted_by := (select auth.uid());
    new.adjusted_at := now();
  end if;
  return new;
end;
$$;

create trigger audit_time_entry_correction
  before update on time_entries
  for each row execute function public.audit_time_entry_correction();

-- Admin "delete" = soft-delete (spec §6.6). Only admin may flip voided, in
-- either direction (restore is allowed); the who/when stamps are set here,
-- never by the caller, and entries cannot be born voided.
create or replace function public.enforce_time_entry_void()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.voided := false;
    new.voided_by := null;
    new.voided_at := null;
  elsif old.voided is distinct from new.voided then
    if (select public.app_role()) is distinct from 'admin' then
      raise exception 'only admin may void or restore a time entry';
    end if;
    if new.voided then
      new.voided_by := (select auth.uid());
      new.voided_at := now();
    else
      new.voided_by := null;
      new.voided_at := null;
    end if;
  else
    -- voided unchanged: stamps are immutable
    new.voided_by := old.voided_by;
    new.voided_at := old.voided_at;
  end if;
  return new;
end;
$$;

create trigger enforce_time_entry_void
  before insert or update on time_entries
  for each row execute function public.enforce_time_entry_void();

-- Every screen and total except the Admin audit view reads this view, so a
-- forgotten `where not voided` cannot leak voided hours into reports.
-- security_invoker: the querying user's RLS on time_entries still applies.
create view public.active_time_entries
with (security_invoker = true) as
  select * from public.time_entries where not voided;

-- Created after the bulk grant above, so grant explicitly.
grant select on public.active_time_entries to authenticated, service_role;

-- ══ Column guards RLS cannot express ══════════════════════════════
-- Workshop's update policy on operations exists only for flagging blocks;
-- RLS cannot restrict columns, so a trigger holds the line.
create or replace function public.enforce_workshop_operation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select public.app_role()) = 'workshop'
     and (old.build_id        is distinct from new.build_id
       or old.phase_id        is distinct from new.phase_id
       or old.description     is distinct from new.description
       or old.estimated_hours is distinct from new.estimated_hours
       or old.status          is distinct from new.status
       or old.depends_on      is distinct from new.depends_on
       or old.business_unit   is distinct from new.business_unit)
  then
    raise exception 'workshop role may only change blocked / blocked_reason';
  end if;
  return new;
end;
$$;

create trigger enforce_workshop_operation_update
  before update on operations
  for each row execute function public.enforce_workshop_operation_update();

-- Notes are append-only for everyone: after insert, only `hidden` may change.
create or replace function public.enforce_note_hide_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.build_id      is distinct from new.build_id
     or old.author_id  is distinct from new.author_id
     or old.body       is distinct from new.body
     or old.business_unit is distinct from new.business_unit
  then
    raise exception 'notes are append-only; only hidden may be changed';
  end if;
  return new;
end;
$$;

create trigger enforce_note_hide_only
  before update on notes
  for each row execute function public.enforce_note_hide_only();
