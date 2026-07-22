# Trial Workflow

**Living document.** This describes how work flows through the planner
day-to-day. It is updated in the same commit as any change that alters the
workflow — if the app changes and this file doesn't, that's a defect.
(Companion docs: [trial-notes.md](trial-notes.md) for rules/gotchas,
[logins.md](logins.md) for accounts.)

Last updated: 20 July 2026.

## The loop

```
Order in → Order Book → Operations & materials → Production board
   → Shopfloor clocking → Corrections (if needed) → Reports → Despatch
```

## 1. Order arrives (Sophie)

1. **Order Book → New build.** BU number, part (create it in Build History
   first if it's a new part number), customer (mandatory), optional
   project, PO number, dates, both OrderWise SO refs. Status starts at
   *Order*.
2. On the build page, add **phase operations** (Mechanical / Electrical /
   Inspection) with estimated hours — these are what gets scheduled.
3. Add **outstanding material lines** with expected dates. Set the
   customer's **badge colours** on the customer record if not already done
   — that's how they read at a glance on the board.

## 2. Scheduling (Sophie / Andrew / Liam)

1. **Production.** Fortnight view by default; Load & capacity sits
   collapsed at the top — expand before committing a heavy week.
2. Open **Unscheduled work**, hit *Assign* on an operation: worker, date
   range, hours/day, and the overtime mode (skip weekends / weekend OT /
   all OT for early-late working). The preview line states exactly what
   will be created.
3. Click any bar to move, re-crew, re-hour, or remove it. Every change has
   a 6-second **Undo** and Ctrl+Z.
4. Watch the ⚠ flags (holiday, competency, >7.5h, past delivery) — they
   warn, never block. ⏱ chips show where OT has actually been *booked*
   (clockings, including later corrections), beside what was planned.

## 3. On the floor (everyone who builds)

1. Kiosk at `/shopfloor`, signed in as the kiosk account. Tap your name,
   tap the job. Tapping a different job later switches automatically —
   no need to clock off first.
2. Something in the way? Type a short reason and **Flag blocked** — it
   shows on the board immediately. Unblock when it's moving again.
3. Red-pen markup or site photo → add it as a **note attachment** on the
   build (via the build page, or hand it to Sophie/admin during the trial).
4. First clock-on moves the build to *In-Build* automatically.

## 4. Housekeeping (Andrew / Liam, daily during trial)

1. **Clockings**: review anything stamped *auto-closed*, fix mis-clocks
   (corrections keep originals + who/when), add entries for anyone the
   kiosk missed. Delete = void, restorable under *Show deleted*.
2. Until Phase 5 schedules it, run the forgotten-clock-off sweep by hand
   (Studio → SQL): `select public.auto_close_open_time_entries();`
3. Update build **status** as things progress (Picked, On-hold, Ready for
   despatch); despatched builds drop off the live views.

## 5. Reading the week (anyone)

- **Dashboard** — today's crew, this week's load, attention items.
- **Reports** — build progress (est vs actual), utilisation (std/1.5×/2×
  vs capacity), schedule adherence (with unscheduled-hours honesty flag),
  materials chase list, customer/project rollup. Every report → CSV for
  the costing sheet; OT is classified, never priced.

## Refinements adopted during the trial

- 20 Jul: Load moved above the board (collapsible) so long schedules don't
  bury capacity. Customer badges colour-coded. Booked-OT ⏱ chips added.
- *(add each workflow change here, newest first)*
