# CLAUDE.md — ESD Production Planner

Project context for Claude Code. Read this before making changes. The authoritative
requirements document is `docs/esd-production-planner-spec-v0.4.md` — if this file
and the spec conflict, the spec wins; flag the conflict rather than guessing.

## What this project is

A standalone production planner for TIC's Engineered Services Division (ESD), which
builds control panels and assemblies. Two developers (Andrew, Liam), both learning —
explain non-obvious decisions in PR descriptions and commit messages. This tool is
also a rehearsal for a larger ERP build, so prefer patterns that generalise
(RLS, migrations-in-Git, typed queries) over quick hacks.

## Stack

- Supabase (Postgres, Auth, RLS, Realtime, Storage) — LOCAL via `supabase start`
  (Docker/WSL2). No cloud project exists. Never suggest `supabase link` or cloud
  deployment; production will be self-hosted Docker on an office server later.
- Next.js (App Router) + React + TypeScript. Tailwind for styling.
- No money anywhere: this system stores hours and overtime classification
  (none / 1.5x / 2x) only — never £ values, rates, or margins.

## Non-negotiable domain rules

1. Every transactional table carries `business_unit text not null default 'ESD'`.
2. Builds are identified by unique BU numbers and ALWAYS belong to a customer
   (customer_id is NOT NULL). Builds link to a part; a part is built many times.
3. Phases are Mechanical, Electrical, Inspection. Mechanical and Electrical run
   concurrently as a matter of course — never enforce sequencing by default.
4. Build statuses are reference data (seeded: Order, Part-Picked, Picked, In-Build,
   On-hold, Ready for despatch), never enums or hard-coded strings in app code.
5. Standard day: 07:30–16:00, break 12:00–13:00, 7.5 productive hours, Mon–Fri.
   Anything outside is overtime: 1.5x class Mon–Sat, 2x class Sunday. OT class on
   time entries is derived from timestamps, not user-entered.
6. Time entries are never hard-edited or deleted. Corrections (Admin only) keep
   original values in `original_values` jsonb and record who/when. Notes are
   append-only; Admin can set `hidden`, never delete.
7. `materials_complete` on builds is a manual flag set by Commercial. Material
   status is informational only — it must never block scheduling.

## Database workflow

- Schema changes ONLY via `supabase migration new <name>` files, committed to Git.
  Never modify the DB through Studio and walk away — capture it as a migration.
- Seed/reference data in `supabase/seed.sql`. `supabase db reset` must always
  produce a working system.
- RLS on every table, no exceptions. Roles: admin, commercial, workshop, viewer
  (stored in a `profiles` table keyed to auth.users). Write policy tests as SQL
  in `supabase/tests/` when adding policies.
- The shopfloor PC uses a single dedicated kiosk auth user with workshop-level
  policies; worker identity on a time entry comes from the selected worker_id,
  not from auth.uid().

## UI conventions

- Desktop-first for Admin/Commercial screens (build entry, scheduling, reports).
- Shopfloor routes (`/shopfloor/*`) are tablet-first: large touch targets,
  minimal typing, test at iPad Safari dimensions (1024x768 and 1194x834).
- All screens must remain usable at tablet widths — degrade gracefully, never break.
- Dates display dd/mm/yyyy (UK). Times 24-hour.

## Working practices

- Small PRs, one concern each. Migrations in their own commits.
- TypeScript strict; generate DB types with `supabase gen types typescript --local`
  after every migration and commit the output.
- No secrets in the repo. `.env.local` is gitignored; `.env.example` documents
  every variable with a dummy value.
- When a requirement is ambiguous, check the spec in `docs/`; if still ambiguous,
  ask rather than assume — Andrew and Liam review together.
