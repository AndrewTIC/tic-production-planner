# ESD Production Planner

Standalone production planning, clocking, and build-history tool for TIC's
Engineered Services Division. Spec: `docs/esd-production-planner-spec-v0.4.md`.
Conventions for Claude Code and humans: `CLAUDE.md`.

## Prerequisites (one-time, per developer)

1. **Docker Desktop** with the WSL2 backend (Windows). Verify: `wsl --status`
   shows Default Version: 2, and Docker Desktop starts cleanly.
2. **Node.js LTS** (v20+): `node --version`.
3. **Supabase CLI**: `npm install -g supabase` (or via Scoop). Verify:
   `supabase --version`.
4. **Git** with access to this repository.

## Clone to running

```bash
git clone <repo-url> esd-planner
cd esd-planner

# Start the local Supabase stack (first run pulls images — allow a few minutes)
supabase start
# Note the API URL and anon key it prints.

# Configure the app
cp .env.example .env.local
# Paste the local API URL and anon key from `supabase start` output into .env.local

# Apply schema + seed data
supabase db reset

# Run the app
npm install
npm run dev
```

App: http://localhost:3000 — Supabase Studio (DB admin): http://localhost:44323
(local ports are 443xx, not the Supabase defaults — see supabase/config.toml)

## Day-to-day

| Task | Command |
|---|---|
| Start / stop local stack | `supabase start` / `supabase stop` |
| New schema change | `supabase migration new <name>`, edit the SQL file, then `supabase db reset` |
| Rebuild DB from scratch | `supabase db reset` (runs all migrations + seed) |
| Regenerate TS types after a migration | `npm run gen:types` |
| Run app | `npm run dev` |

**Rule: all schema changes are migration files committed to Git.** If
`supabase db reset` doesn't reproduce your database, the change isn't real yet.

## Local dev logins

Seeded by `supabase db reset` — local development only. Password for all
accounts: `planner-dev`. Public sign-up is disabled; users are admin-managed.

| Email | Role |
|---|---|
| andrew@tic-direct.com | admin |
| liam@tic-direct.com | admin |
| sophie@tic-direct.com | commercial |
| kiosk@tic-direct.com | workshop (shared shopfloor PC) |
| richard@tic-direct.com | viewer |

The seed also creates six workers (competencies included) and a small
sample dataset — one customer/project, two parts, and builds BU12001 and
BU12002 with phase operations and an outstanding material line — so a
fresh reset gives you something to click through immediately.

## Progress (build plan, spec §9)

- **Phase 0 — dev environment: done.** Repo, migrations-in-Git workflow,
  seed, `.env.example`, local Supabase on 443xx ports.
- **Phase 1 — foundations: done.** Auth with the four roles (RLS proven
  by pgTAP tests); CRUD registers for customers, projects, parts, and
  builds with order metadata, OrderWise refs, statuses, and material
  readiness (manual flag + outstanding lines, informational only).
- **Phase 2 — capacity and schedule: done.** Workers with phase
  competencies, holiday calendar (incl. AM/PM half days), operations on
  builds, and the production board: build rows over a fortnight, multi-day
  assignment with overtime modes and undo, conflict flags, and the load
  view against real capacity.
- **Phase 3 — shopfloor and documents: done.** Kiosk clocking (identity
  from the dropdown, auto job-switch, In-Build on first clock-on), admin
  corrections with void/restore audit, worked time net of the unpaid
  break, timestamped OT segments, per-build notes (append-only, with
  attachments) and the private document repository.
- **Phase 4 — reporting: reports done, trial running.** All five reports
  with Excel-safe CSV export. Trial edge cases still to exercise.
- Phase 5 (office-server deployment, backups, scheduled jobs) not started.

**Running the trial? Read [docs/trial-notes.md](docs/trial-notes.md)** —
the operational reference: what's enforced silently, what's still manual
(the auto clock-off must be run by hand), how to read the reports, and
what the trial should deliberately exercise.

Domain rules that trip people up: time entries can never be hard-deleted
(admin delete = audited soft-delete via `voided`; query
`active_time_entries`, not the table); worked time excludes the unpaid
12:00–13:00 break; OT is derived from timestamps and split into
timestamped segments, never entered; material status never blocks
scheduling.

## Design intent (short version)

- Desktop-first for planning/admin screens; `/shopfloor/*` routes are
  tablet-first for the shared workshop PC now and iPads later.
- Hours only, never money. Overtime is classified (1.5x Mon–Sat, 2x Sun),
  rates are applied outside this system.
- Roles: admin (Andrew, Liam), commercial (Sophie), workshop, viewer.
  Role gating in the UI is presentational; RLS is the enforcement.
- Reference data (statuses, phases) lives in tables, never in code.
- Registers deactivate, never delete (customers, workers); half-day
  holidays are single-date rows (AM = 4.5h, PM = 3h against the
  standard day).

## Deployment

None yet — development is entirely local. Production will be self-hosted
Docker on the office server (see spec §8a); Lane Systems involvement is
parked until the tool is ready for mass use. Nothing in this repo may
assume Supabase Cloud.
