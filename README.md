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

App: http://localhost:3000 — Supabase Studio (DB admin): http://localhost:54323

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

## Design intent (short version)

- Desktop-first for planning/admin screens; `/shopfloor/*` routes are
  tablet-first for the shared workshop PC now and iPads later.
- Hours only, never money. Overtime is classified (1.5x Mon–Sat, 2x Sun),
  rates are applied outside this system.
- Roles: admin (Andrew, Liam), commercial (Sophie), workshop, viewer.

## Deployment

None yet — development is entirely local. Production will be self-hosted
Docker on the office server (see spec §8a); Lane Systems involvement is
parked until the tool is ready for mass use. Nothing in this repo may
assume Supabase Cloud.
