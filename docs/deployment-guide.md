# Deployment guide — trial hosting

Two ways to host the trial away from Andrew's dev PC: **Liam's laptop**
(30 minutes, identical to dev) or the **office server** (the Phase 5
shape, still LAN/VPN-only). Both keep every URL and login the same for
users.

> Security honesty: the Supabase CLI's local stack uses **shared demo JWT
> keys** — fine inside the office network or VPN for the trial, not for
> anything internet-facing. Real secrets, TLS via Caddy, and the full
> self-hosted compose stack are Phase 5 hardening, before any exposure
> beyond the LAN.

## Option A — Liam's laptop (recommended for the trial)

Prerequisites: Windows 10/11, [Node.js LTS 20+](https://nodejs.org),
[Docker Desktop](https://docker.com) (WSL2), Git.

```powershell
git clone https://github.com/AndrewTIC/tic-production-planner.git
cd tic-production-planner
npm install
copy .env.example .env.local      # the defaults are already correct locally
npx supabase start                # first run downloads images (~5 min)
npx supabase db reset             # ONCE — builds schema + seed logins
```

Then create the desktop shortcut from **docs/run-locally.md** and it's the
same one-double-click routine as Andrew's PC. Check the 443xx ports are
free on that machine (`netsh interface ipv4 show excludedportrange
protocol=tcp` — if 44320–44329 fall in a reserved band, pick new ports in
`supabase/config.toml`).

Laptop settings that matter for a shared host: plugged in, **Sleep =
Never** while the trial runs, firewall prompt allowed on Private networks.

**Moving trial data between machines** (e.g. dev PC → laptop):

```powershell
# on the old machine
docker exec supabase_db_tic-production-planner pg_dump -U postgres postgres > planner-backup.sql
# on the new machine, after supabase start (NO db reset afterwards)
type planner-backup.sql | docker exec -i supabase_db_tic-production-planner psql -U postgres postgres
```

## Option B — office server (Phase 5 shape)

Same steps as Option A, then production-grade touches:

1. **Production build instead of dev mode:**
   ```powershell
   npm run build
   npm run start:lan        # serves the optimised build on 0.0.0.0:3000
   ```
2. **Start on boot** — Task Scheduler → Create Task → run at startup,
   whether logged on or not:
   `powershell -ExecutionPolicy Bypass -File C:\...\start-planner.ps1`
   (edit the script's last line to `npx next start -H 0.0.0.0` for the
   production build).
3. **Nightly backup** — Task Scheduler, daily 22:00:
   ```powershell
   docker exec supabase_db_tic-production-planner pg_dump -U postgres postgres > D:\backups\planner-$(Get-Date -Format yyyy-MM-dd).sql
   ```
   Keep copies somewhere that is not the server.
4. **Auto clock-off sweep** — Task Scheduler, weekdays 16:10:
   ```powershell
   docker exec supabase_db_tic-production-planner psql -U postgres -c "select public.auto_close_open_time_entries();"
   ```
   (Replaces the manual step in trial-notes §5.)
5. **Real users** — delete/ignore the seeded dev logins for production
   use: create real accounts in Studio (Auth → Users) and give each a
   `profiles` row with the right role. `docs/logins.md` applies to
   dev/trial only.
6. **Access** — in-building via `http://<server>:3000`; remote via the
   existing VPN. Nothing is exposed to the internet.

## What deliberately waits for full Phase 5

Self-hosted Supabase compose with unique JWT/DB secrets, TLS (Caddy),
containerised Next (`output: "standalone"` is already configured),
monitoring, and restore drills.
