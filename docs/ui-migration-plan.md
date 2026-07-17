# UI Migration Plan — Design Spec v1.2 onto the Existing Codebase

**Ground rule:** the existing codebase is the source of truth for behaviour,
data model, and domain rules. The design spec (docs/design-spec-v1.2.md) is
the target for *look, layout, and interaction patterns*. Where the two
conflict, functionality and the functional spec win, and the deviation is
recorded here. Refactor incrementally; replace a component only when the
design spec cannot be met by restyling it.

## 1. Conflicts and resolutions

| # | Design spec says | Resolution |
|---|---|---|
| 1 | "Jobs", TIC-#### numbers | Keep **builds / BU numbers** (CLAUDE.md non-negotiable #2). The design spec's job examples are cosmetic. |
| 2 | §4 canonical status taxonomy (7 statuses incl. "Engineering Review") | Build statuses stay **reference data** (non-negotiable #4). Adopt the *palette*, map onto our data: In-Build → blue "In Progress" pair; Ready for despatch → lime "Complete" pair; On-hold → amber "Attention" pair; material badge → amber "Awaiting Material" pair; operation `blocked` → red "Blocked" pair; priority Urgent → red "Urgent" pair. "Engineering Review" is not in this product's domain — unused token, kept for the ERP. |
| 3 | §15 timeline rows = employees | **Rows = builds (BU numbers first column)** — Andrew's direction, 17 Jul 2026, supersedes both this and spec §6.5's wording. Functional spec needs a v0.4.2 note. Cells show worker · phase · hours chips. |
| 4 | §15 "Jobs never render into non-working time" | Conflicts with schedulable weekend/holiday **overtime** (functional spec §6.4). Weekends/closures keep the `neutral-100` shading but ARE valid drop targets; OT assignments render with the amber OT treatment. Functional spec wins. |
| 5 | §37 light mode only in v1, no toggle | **Superseded — Andrew, 17 Jul 2026: light/dark toggle ships in v1.** Implemented as a class-based theme (`.dark` on `<html>`, header toggle, localStorage + pre-hydration script). Light is the default; `dark:` variants stay and migrate onto tokens during Phase B. |
| 6 | §13 workspaces: Dashboard · Production · Jobs · Materials · Workshop · Reports · Settings | Map to existing routes: Dashboard → `/`, Production → `/schedule`, Jobs → `/builds`, Workshop → `/workers` + `/holidays`, Materials → future due/overdue view (Phase 4 reporting), Reports/Settings → future. Registers (customers/projects/parts) live under a "Jobs" section or Settings-adjacent grouping — decide in Phase C. |
| 7 | Logo `TIC-logo.png` "supplied" | Supplied 17 Jul 2026, lives at `public/TIC-logo.png`, rendered 32px in the header. Never recolour/stretch it or place it on lime/grey. |
| 8 | §30 phone read-only companion | Compatible with, but separate from, the CLAUDE.md tablet-first **shopfloor** requirement. The kiosk clocking screens (Phase 3) are not covered by the design spec; they follow its tokens but their own layout rules (large targets, minimal typing). |

## 2. What is reused untouched

- **All server actions, RLS policies, migrations, seed, pgTAP tests** — the
  design spec is explicitly GUI-only.
- **Route structure and data queries** in every page; auth flow
  (`proxy.ts`, login, `getUserProfile`).
- **Domain components**: `materialBadge()` logic, `CustomerProjectSelect`,
  `lib/schedule.ts`, `lib/format.ts` (dd/mm/yyyy stays — the design spec
  doesn't define date format; CLAUDE.md does).
- **Page inventory**: no screen is deleted. Registers keep list → new →
  detail shape; only their skin changes.

## 3. Component extraction map (Phase B)

Current repeated Tailwind strings → one primitive each in `components/ui/`:

| Primitive | Extracted from | Design spec ref |
|---|---|---|
| `Button` (primary/secondary/ghost/danger/icon) | every form + nav button | §19 |
| `Badge` (status/priority/material/phase variants via mapping tables) | chips across all screens | §4, §21 |
| `Card` | overview cards, backlog items | §20 |
| `Field` (label + input/select/textarea + error) | all forms | §23 |
| `TableShell` (rounded container, sticky header, row styling) | all list screens | §22 |
| `EmptyState` | list empty branches | §26 |
| `Skeleton` | new (loading.tsx per route) | §27 |
| `SidePanel` | new | §17 |
| `Toast` (+ undo) | new — needed by board slice 2 | §16, §25 |

## 4. Phases (each = one PR, app works after every one)

- **A. Tokens + typography** *(started)* — `@theme` tokens in `globals.css`
  (lime, neutrals, status pairs, semantic aliases, radii, shadows, motion),
  Inter via `next/font`. No layout changes; screens still read zinc until
  Phase B swaps them. Zero functional risk.
- **B. Primitives + mechanical restyle** — extract the §3 table, restyle
  screen-by-screen (registers first, they're pattern-identical), removing
  `dark:` variants as touched. Buttons hit 44px touch height (§19), inputs
  48px (§23), tables get §22 treatment.
- **C. App shell** — 64px header (wordmark · workspace name · search
  placeholder · profile · sign out) + collapsible sidebar (72/240px,
  lime-100 active pill), replacing the current top nav. Login page keeps its
  own bare layout.
- **D. Board to spec** — lands WITH scheduling slices 2–3, not before:
  today marker (`lime-700`), unassigned lane as a pinned top lane, assignment
  create/move with the mandatory undo toast (§16), overload amber tint as
  part of conflict flagging, Job Side Panel as the Level Two pattern (the
  `/builds/[id]` page remains Level Three). Building drag interactivity
  directly in the new system avoids styling it twice.
- **E. Polish** — empty-state and error microcopy voice (§26/§28),
  skeletons (§27), `Ctrl/Cmd+K` search (§24), notifications (§25, after
  Phase 3 realtime exists), workshop status banner on the dashboard (§14).

Sequencing against the build plan: A + B now (cheapest while screens are
few), C next, D merged into scheduling slices 2–3, E alongside Phases 3–4.

## 5. Open items for Andrew / Liam

1. ~~Supply `TIC-logo.png` for `public/`~~ — **done 17 Jul 2026**, wired
   into the header at 32px (full §12 header lands in Phase C).
2. ~~Confirm dropping dark mode~~ — **decided 17 Jul 2026: keep dark mode,
   with a header toggle** (see conflict #5).
3. ~~Confirm sidebar naming~~ — **decided 17 Jul 2026: "Production"**; the
   route moved to `/production` with a permanent redirect from `/schedule`.
4. Record the builds-as-rows decision in the functional spec (v0.4.2).
