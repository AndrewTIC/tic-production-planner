# Trial Reference Notes

Working reference for the local trial (spec §9, Phase 4). This collects the
decisions, behaviours, and gotchas that are otherwise scattered across
commit messages and code comments, so nobody has to read thirty commits to
find out why the system did something. Update it as the trial surfaces more.

Last updated: 20 July 2026 (through commit `a2ff1b5`).

## 1. Where the project stands

- **Phases 0–3: complete.** Dev environment, auth with the four roles, all
  registers (customers, projects, parts, builds, workers, holidays), phase
  operations, the production board (build rows, multi-day scheduling with
  undo, fortnight view, conflict flags, load vs capacity), shopfloor
  clocking kiosk, admin corrections with audit, per-build notes and the
  document repository.
- **Phase 4: reports done.** All five (build progress, utilisation,
  schedule adherence, materials due/overdue, customer/project analysis),
  each with CSV export. Remaining Phase 4 scope is exercising edge cases
  during this trial — see §7.
- **Phase 5 (not started):** office-server deployment, backups, and the
  scheduled jobs listed in §5.
- Database test suite: **49 pgTAP tests**, run with `supabase test db`.

## 2. Running the trial

The trial serves from a developer PC (spec §6.6) with everyone else
browsing to it. Local URLs:

| What | Where |
|---|---|
| App | http://localhost:3000 (LAN: the dev PC's address, port 3000) |
| Supabase API | http://127.0.0.1:44321 |
| Supabase Studio (DB admin) | http://127.0.0.1:44323 |

Ports are **443xx, not the Supabase defaults** — Windows/Hyper-V reserves
random blocks that swallowed 543xx (see the note in `supabase/config.toml`).

Dev logins (password `planner-dev` for all): andrew@ / liam@ (admin),
sophie@ (commercial), kiosk@ (workshop — the shared shopfloor PC),
richard@ (viewer), all @tic-direct.com. Public signup is disabled; users
are admin-managed.

**⚠ Once real trial data exists, never run `supabase db reset`.** Reset
rebuilds from migrations + seed and destroys everything entered since. It
is a development tool. (The seed's sample builds BU12001/BU12002 exist so a
fresh reset is demonstrable — they can be ignored or deleted for the trial.)

Machine gotchas (dev PC): Docker Desktop does not auto-start after a
reboot; if `supabase start` then complains "already running" with dead
containers, run `supabase stop` then `start` — it's a stale lock. Node
lives at `C:\Program Files\nodejs` and is not on every shell's PATH.

## 3. Who does what during the trial

Per spec §6.6 the trial can run **wholly admin-managed**: Andrew/Liam enter
clockings on workers' behalf from **Clockings** (admin-only nav entry),
which has an "add on someone's behalf" form. The kiosk (`/shopfloor`) works
today as well — either mode, no configuration.

- **Sophie (commercial):** order handover — customers/parts/builds with
  order metadata and OrderWise refs, material lines, the board
  (Production), holidays, all reports.
- **Workshop (kiosk login):** tap name → tap job. Clocking onto new work
  ends the previous entry automatically; blocked flags (with reason) show
  on the board immediately; red-pen photos attach to notes.
- **Viewers:** everything read-only; no write controls render, and RLS
  refuses writes regardless of what the browser sends.

## 4. Rules the system enforces silently

These are the behaviours most likely to prompt "why did it do that":

- **Worked time excludes the unpaid 12:00–13:00 break.** A 07:30–16:00 day
  is 7.5 h, not 8.5. The deduction is shown on the entry ("−60m break"),
  never silent. If someone genuinely worked through lunch, an Admin
  corrects the entry — the system cannot know otherwise.
- **Overtime is derived from timestamps, never entered, and is timestamped
  itself.** Entries are split at the standard-day boundaries: Mon–Fri
  07:30–16:00 is standard, anything either side is 1.5×; Saturday all
  1.5×; Sunday all 2×. A 06:00–18:00 shift is three segments (90 min OT,
  7.5 h std, 2 h OT). One clock-on stays one entry — nobody clocks twice
  to cross 16:00. The entry-level OT badge answers "was there any OT";
  the segments are authoritative for *hours*.
- **First clock-on moves a build to In-Build** — automatically, forward
  only (an On-hold or Ready-for-despatch build is never dragged back).
- **Time entries are never destroyed.** Admin "delete" is a void: values
  kept, who/when stamped, excluded from every total and screen except
  Clockings → Show deleted, restorable from there. Corrections keep the
  original values on the entry. Hard deletion is impossible at the
  database for every role.
- **Notes are append-only.** No edit, no delete; Admin can hide (stays on
  the record, visible to Admins). Attachments ride on notes — that is the
  *only* way workshop can add a document, by design.
- **Material status never blocks anything.** Badges and the due/overdue
  report inform the scheduler; they gate nothing (CLAUDE.md rule 7).
- **Registers deactivate, never delete** (customers, workers) — history
  survives. Parts persist across orders; don't reuse a part record for a
  different part.
- **Documents are private.** No public URLs; downloads are 60-second
  signed links minted per click.
- **Hours only, never money.** OT classification (1.5×/2×) is carried
  through to CSV so Finance applies rates externally. Nothing in the
  system multiplies an hour by anything.

## 5. Not automatic yet — manual during the trial

- **End-of-shift auto clock-off is built but NOT scheduled.** Until Phase 5
  wires it to pg_cron on the office server, run it manually (Studio SQL
  editor, end of day or next morning):

  ```sql
  select public.auto_close_open_time_entries();
  ```

  It closes forgotten entries at **16:00 on the day they started** (never
  "now") and stamps them `auto-closed` for review on the Clockings screen.
- **Schedule adherence trusts the board.** "Scheduled completion" is the
  last assignment date, so it drifts if the board isn't kept current. The
  "unscheduled hours remaining" column is the guard — a build showing
  on-time with hours still to place is not really on time. Watch whether
  this reads clearly to Sophie in practice.
- **No drag-and-drop yet.** Scheduling is click-to-assign: Assign from the
  Unscheduled work drawer (date range + hours/day + OT mode), click a bar
  to edit or remove. Every change has a 6-second Undo toast and Ctrl+Z.

## 6. Reports and CSV

All five reports live under **Reports**; every one exports CSV via the same
query the screen uses, so a downloaded figure always matches the screen.

Excel specifics (deliberate): UTF-8 BOM (accented names survive), CRLF,
dd/mm/yyyy, hours to two decimals. Cells starting with `=`, `+`, or `@`
are quoted so a part code can't execute as a formula — but **negative
numbers are exempt** (a variance of `-42.50` stays a number Excel can sum;
this was a bug caught and fixed on 20 Jul).

Interpretation notes:
- **Utilisation %** is standard hours against standard capacity; OT sits
  on top of capacity and is shown beside the percentage, never inside it.
  Capacity is 7.5 h/worker/weekday net of holidays (AM absence = 4.5 h,
  PM = 3 h — the halves are not equal).
- **Phase-grouped figures overlap**: a multi-skilled worker counts in every
  phase they hold. The all-phases/total line is the honest ceiling.
- **Build progress "projected"** assumes an unfinished operation still
  needs at least its estimate, so overrun is a forecast, not just hours
  already lost.

## 7. What this trial should exercise (open Phase 4 scope)

Deliberately try, and note what happens:

1. **Estimate change mid-build** — raise/lower an operation's hours after
   time is booked; check build progress and overrun follow sensibly.
2. **Correction flows end-to-end** — wrong worker, wrong BU, forgotten
   clock-on and clock-off, void + restore; confirm the audit trail reads
   right and OT reclassifies itself after each correction.
3. **The auto clock-off routine** (§5) after a deliberately forgotten
   clock-off.
4. **A real week of scheduling** — does fortnight-by-default work? Are the
   conflict flags (holiday, competency, >7.5 h, past delivery) noisy or
   useful? Does the load view line up with gut feel?
5. **CSV round-trips into the actual costing spreadsheet** — columns,
   sums, dates.

## 8. Known limitations and deferred items

- UI migration to the design spec is at **Phase A** (tokens, theme toggle,
  logo). Phases B–E — component restyle, sidebar shell, board-to-spec with
  drag, side panels, Cmd+K search — are planned in
  `docs/ui-migration-plan.md`. Function first, polish behind it.
- Board zooms Day and Month don't exist (Fortnight/Week do).
- Per-worker standard-day patterns aren't editable (everyone is
  07:30–16:00 Mon–Fri; the schema supports variation later).
- `operations.depends_on` exists in the schema but has no UI — Mechanical
  and Electrical run concurrently as the normal case.
- Realtime push (board updating live as the kiosk clocks) is not wired;
  screens show fresh data on load/refresh.
- Phone layout is untested; desktop and iPad sizes are.

## 9. Capturing trial feedback

Log observations as **notes on the build they concern** where possible
(they're timestamped and attributed). For anything system-wide, add it to
this file under a "Trial findings" heading in a PR — the notes screen
belongs to builds, this file belongs to the trial.
