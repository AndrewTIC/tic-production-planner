# TIC Production Planner
## GUI / UI Design Specification
### Version 1.2 — Front-End Design System

---

## What Changed From v1.0 (Lead Designer's Notes)

Version 1.0 established an excellent philosophy. Version 1.1 makes it buildable. A developer (or Claude Code) reading v1.0 would have had to invent dozens of details — exact colours, component states, timeline mechanics — and every invention is a chance for inconsistency. This revision closes those gaps without violating a single v1.0 principle.

**Key improvements:**

1. **Concrete design tokens.** "TIC Green" and "very light neutral grey" are now exact hex values with names, so every screen uses identical colours. Tokens are the mechanism that guarantees Section 37 (future modules inherit the design language automatically).
2. **Status system unified.** v1.0 defined five status colours (§4) but six badges (§21) — "Awaiting Material" and "Urgent" had no colour. This contradiction is resolved with a single canonical status table used everywhere.
3. **Timeline mechanics specified.** Row heights, zoom levels, the today marker, non-working time, overload signalling, and an Unassigned lane. The hero component is now fully described, not just admired.
4. **Component states defined.** Every button, card, and badge now has default / hover / pressed / focus / disabled states. Touch and keyboard users get explicit treatment.
5. **iPad gesture conflict resolved.** v1.0 assigned both "swipe = navigate timeline" and "long press = move job" without explaining how they coexist. §16 now defines the full gesture model.
6. **Microcopy voice added.** Empty states, errors, and notifications now have a written voice guide with examples, so the words feel as designed as the pixels.
7. **Accessibility made testable.** "High contrast" is now WCAG AA with specific ratios and a defined focus ring.

Nothing from v1.0 has been removed. Where v1.0 stated a principle, v1.1 states the principle *and* the measurement.

**v1.2 addendum — review fixes.** Every issue from the design review has been applied: header/logo order defined, overlapping-job behaviour on the timeline, drag undo, side-panel unsaved-changes rule, semantic tokens, adaptive-banner thresholds, phone behaviour, timeline screen-reader model, and the §3/§35/§38 redundancies merged. Section numbers are unchanged so existing references stay valid.

**v1.1.1 addendum — real brand colours.** Tokens are now derived from the actual TIC logo: TIC Lime `#B0CB1F` and brand grey `#898989`. Because lime is a light colour, white-on-lime is forbidden (fails contrast); all lime fills carry dark charcoal text, and darker lime shades (`lime-700`/`lime-800`) handle lines, links, and focus states. The logo file (`TIC-logo.png`) is supplied for the header lockup.

---

## Logo Usage

- Header: logo sits at the far left, 32px tall, with 16px clear space on all sides, followed by the current workspace name — the definitive left-to-right header order is in §12. It is the only place the full-colour logo appears in the interface.
- Never recolour, stretch, add effects to, or place the logo on lime or grey backgrounds.
- Loading/splash screen: logo centred on `neutral-50`, nothing else.
- The lime swoosh in the logo is the visual ancestor of the interface's lime accents — the app should feel like it grew from the logo, not like the logo was pasted onto it.

---

## Purpose

This document defines the complete visual identity, design philosophy, interaction model and component standards for the TIC Production Planner.

This document is intentionally GUI/UI only. It does not define database structure, business logic, backend architecture, authentication, APIs or data models.

Its only purpose is to instruct Claude Code to build a beautiful, modern, intuitive production planning interface that could compete visually with the best commercial SaaS applications.

---

## 1. Product Vision

The Production Planner is the operational heart of the future TIC ERP ecosystem. Future modules (CRM, Purchasing, Stores, QA) will inherit this design language, but this project focuses solely on creating the best possible production planning experience.

The application should feel less like a traditional ERP and more like a premium software product.

Target feeling: **Modern. Minimal. Premium. Calm. Fast. Intuitive. Professional.**

Each adjective is enforced by a measurable rule, not left to taste: *calm* = one hero per screen (§33) and the restrained palette (§4); *fast* = motion tokens and skeleton rules (§27, §29); *intuitive* = the Three Second Rule (§34); *premium* = the token system (§4–§9) applied without exception.

The user should enjoy using it every day.

---

## 2. Design Philosophy — Three Levels of Information

The application exists to help users make decisions. It should never attempt to display every available piece of information. The UI answers one question: *What do I need to know right now?*

Information is layered:

| Level | Name | Purpose | Where |
|---|---|---|---|
| One | Overview | Scanning | Timeline, dashboard, lists |
| Two | Selected Item | Decision making | Job Side Panel |
| Three | Dedicated Workspace | Working | Full Job page |

**Rule:** Never combine all three levels onto one screen. Level One stays visible when Level Two opens (the side panel overlays, it never navigates). Level Three is a deliberate destination reached by choice, never by accident.

**Example journey:** Liam scans the timeline and spots TIC-2458 running behind (Level One) → taps the bar, the side panel shows 12 hours remaining against 8 allocated (Level Two) → taps `Open full job` to review drawings and reallocate hours (Level Three). Each step is one deliberate action deeper.

---

## 3. Product Principles

The interface should be: calm, spacious, predictable, consistent, fast, beautiful, touch friendly, future proof.

**Every screen has exactly one visual hero** (see §33).

The single canonical list of always/never rules lives in §38 — this document deliberately has one rule list, not two.

---

## 4. Visual Identity — Colour Tokens

All colours are named tokens. Components reference tokens, never raw hex. This is what makes §37 (future compatibility) real.

### Brand (extracted from the TIC logo)

| Token | Hex | Usage |
|---|---|---|
| `lime-500` (TIC Lime) | `#B0CB1F` | Primary button fill, progress fills, selected highlights — always with dark charcoal text |
| `lime-600` | `#9DB61C` | Primary button hover |
| `lime-700` | `#7A8F14` | Primary button pressed, today marker, small UI accents |
| `lime-800` | `#66780F` | Text links, focus ring, text on lime tints (4.9:1 on white — AA) |
| `lime-100` | `#F4F8DC` | Selected-state tint, "Complete" badge background, progress fill |
| `tic-grey` | `#898989` | Brand grey — logo lockup and decorative marks only, never body text |

> **Hard rule: never place white text on TIC Lime.** `#B0CB1F` on white fails contrast (1.8:1); with `neutral-800` charcoal it passes brilliantly (8:1). Lime fills always carry dark text. Where a lime element must read against white (links, focus rings, thin lines), use `lime-700` or `lime-800`. Lime means "primary action / good news" and nothing else.

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Cards, panels, dialogs |
| `neutral-50` | `#F6F7F8` | App background |
| `neutral-100` | `#EDEFF1` | Table alternating rows, skeleton loaders, non-working timeline time |
| `neutral-200` | `#DFE3E6` | Borders, dividers |
| `neutral-500` | `#6B7480` | Secondary text, captions, helper text |
| `neutral-800` | `#24292E` | Primary text (dark charcoal) |

### Status (canonical — resolves the v1.0 §4/§21 mismatch)

Each status has exactly one colour pair (foreground on tinted background) and one icon. Colour is never the only indicator (§31).

| Status | Foreground | Background | Icon |
|---|---|---|---|
| In Progress | `#1D6FD1` (blue) | `#E7F0FC` | ▶ play-circle |
| Complete | `#66780F` (lime-800) | `#F4F8DC` (lime-100) | ✓ check-circle |
| Attention Required | `#B26A00` (amber) | `#FCF1E0` | ⚠ alert-triangle |
| Awaiting Material | `#B26A00` (amber) | `#FCF1E0` | ⧗ package/clock |
| Blocked | `#C4302B` (red) | `#FBE9E8` | ⛔ octagon |
| Urgent | `#C4302B` (red) | `#FBE9E8` | ⚑ flag |
| Engineering Review | `#6D4FC2` (purple) | `#EFEAFB` | ✎ pencil-ruler |

Amber and red each cover two statuses; the icon and label distinguish them. This keeps the palette calm — five hues, seven meanings.

### Semantic layer

Components never reference raw tokens directly; they reference semantic tokens that map onto them. This one level of indirection is what makes a future theme (or dark mode) a token swap instead of a redesign:

| Semantic token | Maps to |
|---|---|
| `--color-action` | `lime-500` |
| `--color-action-hover` | `lime-600` |
| `--color-action-text` | `neutral-800` |
| `--color-link` | `lime-800` |
| `--color-focus` | `lime-800` |
| `--color-surface` | `neutral-0` |
| `--color-background` | `neutral-50` |
| `--color-border` | `neutral-200` |
| `--color-text` | `neutral-800` |
| `--color-text-secondary` | `neutral-500` |

### Surface rules

No gradients. No glass effects. No transparency. Flat premium surfaces only.

---

## 5. Typography

Font stack: `Inter, "SF Pro Display", "Segoe UI", system-ui, sans-serif`.

Inter is loaded as the primary face; the fallbacks are near-metric-compatible so the layout never shifts.

| Role | Size | Weight | Line height | Letter spacing |
|---|---|---|---|---|
| Display | 32px | 600 | 40px | −0.02em |
| Page Title | 28px | 600 | 36px | −0.015em |
| Section Title | 22px | 600 | 28px | −0.01em |
| Card Title | 16px | 600 | 24px | 0 |
| Body | 15px | 400 | 22px | 0 |
| Body Strong | 15px | 600 | 22px | 0 |
| Caption | 13px | 400 | 18px | 0 |
| Helper | 12px | 400 | 16px | +0.01em |

Numbers in the timeline, tables and stats use **tabular figures** (`font-variant-numeric: tabular-nums`) so columns of hours and percentages align perfectly.

Maximum text line length: 70 characters (~640px at Body size) — prose wider than this is a layout error. Minimum rendered text size on any device: 12px; nothing smaller ships.

Typography creates hierarchy. Colour does not.

---

## 6. Spacing System

8-point grid. Permitted values only: **4, 8, 16, 24, 32, 40, 48, 64.**

- 4 — icon-to-label gaps, badge internal padding (vertical)
- 8 — related elements within a group
- 16 — card internal padding (compact), gaps between form fields
- 24 — card internal padding (default), gaps between cards
- 32 — section separation within a page
- 40–64 — page margins and major regions

Page gutters: 48px at ≥1440px, 32px at 1280–1439px, 24px on iPad. Vertical rhythm between major page regions: 32px everywhere.

The application should feel mathematically consistent.

---

## 7. Corner Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `radius-button` | 12px | All buttons, inputs |
| `radius-job` | 14px | Timeline job bars |
| `radius-card` | 16px | Cards |
| `radius-container` | 20px | Large containers, table wrappers |
| `radius-dialog` | 24px | Dialogs |
| `radius-badge` | full (pill) | Status badges |

---

## 8. Shadows — Three Elevations Only

| Level | Usage | Value |
|---|---|---|
| 1 | Cards | `0 1px 2px rgba(16,24,32,0.05), 0 1px 3px rgba(16,24,32,0.06)` |
| 2 | Dropdowns, side panel, dragged job bar | `0 4px 12px rgba(16,24,32,0.10)` |
| 3 | Dialogs | `0 12px 32px rgba(16,24,32,0.16)` |

Extremely subtle. If a shadow is noticeable before the surface, it is too strong. Shadows are theme tokens (`--shadow-1/2/3`), not hard-coded values — a future dark theme replaces them with border/luminance treatments without touching components.

---

## 9. Icons

One library only (Lucide recommended — rounded, minimal, outlined, consistent). 1.5px stroke, 20px default size, 24px in the header.

Icons communicate function, never decoration. If an icon has no verb, it doesn't ship.

**Canonical icon vocabulary** (Lucide names) — always these, never synonyms: job `clipboard-list` · customer `building-2` · employee `user` · hours `clock` · material `package` · delivery `truck` · drawing `pencil-ruler` · document `file-text` · note `message-square` · search `search` · notification `bell` · settings `settings` · add `plus` · edit `pencil` · complete `check-circle` · warning `alert-triangle` · blocked `octagon-alert`.

---

## 10. Dashboard Philosophy

The dashboard answers four questions:

1. What is happening today?
2. What requires my attention?
3. Who is working on what?
4. Are we on schedule?

Everything else is secondary.

---

## 11. Dashboard Layout

```
┌──────────────────────────────────────────────┐
│ Header                                       │
├──────────────────────────────────────────────┤
│ Workshop Status Banner                       │
├──────────────────────────────────────────────┤
│                                              │
│ PRODUCTION TIMELINE (hero, ~70–75% width /   │
│ dominant vertical share)                     │
│                                              │
├──────────────┬───────────────┬───────────────┤
│ Upcoming     │ Workshop      │ Capacity      │
│ Deliveries   │ Activity      │ Forecast      │
└──────────────┴───────────────┴───────────────┘
```

Nothing competes visually with the timeline. Supporting panels use Card Title + Body only — no colour blocks, no large numbers that pull the eye.

The timeline gets a minimum height of 8 employee rows (512px) before supporting panels appear; if the viewport is shorter, the page scrolls and the panels sit below the fold. The timeline itself scrolls vertically within its container when there are more employees than visible rows — its column header (dates) stays sticky.

---

## 12. Header

64px tall. Definitive left-to-right order: **TIC logo · current workspace name · global search (centred, max 480px wide) · primary action button · notifications · user profile.**

White surface, 1px `neutral-200` bottom border, no shadow. Clean and lightweight.

**Responsive collapse order** (what hides first as width shrinks): 1) workspace name (the sidebar still shows it), 2) primary action label collapses to an icon button, 3) search collapses to a search icon that opens the full search overlay. The logo, notifications, and profile never hide.

---

## 13. Sidebar

- Collapsed: 72px (icons only, labels appear as tooltips on hover / long press)
- Expanded: 240px
- Always fixed. Expansion animates at 200ms ease-out.
- Active workspace: `lime-100` background pill + `lime-800` icon/text. This is the *only* place lime appears in navigation.

Default state: expanded on desktop ≥1440px, collapsed below that and on iPad. The user's manual choice is remembered per device and overrides the default.

Workspaces: Dashboard · Production · Jobs · Materials · Workshop · Reports · Settings.

Think workspaces, not pages.

---

## 14. Workshop Status Banner

One premium summary card replaces multiple KPI cards.

```
Good morning, Liam
Workshop running normally
24 active jobs · 87% capacity · 8 deliveries this week · 3 jobs need attention
```

- Greeting: Section Title. Status line: Body Strong. Metrics: one Body line, dot-separated.
- "3 jobs need attention" is the only interactive metric — it is a quiet text link (amber, underlined on hover/focus) that filters the timeline to those jobs. The banner informs; it never shouts.
- The status line adapts by defined triggers, in priority order: any job Blocked → *"Workshop under pressure — N jobs blocked"*; capacity > 95% or any job Urgent → *"Busy week — running near full capacity"*; capacity < 60% → *"Quiet day — capacity available"*; otherwise → *"Workshop running normally"*. One sentence, plain English, no exclamation marks. The thresholds live in one config constant, not scattered through code.

---

## 15. Production Timeline (Hero Component)

The centrepiece. A digital workshop planning board.

**Structure**

- Rows: employees. Row height 64px (comfortable touch), 48px in "compact" density toggle.
- Row header (left, sticky): avatar or initials + first name + surname initial. 200px wide, collapsible to 72px (avatar only).
- Columns: days or weeks. Zoom levels: **Day · Week · Fortnight · Month**, switched by a segmented control at the timeline's top-right. Default: Week.
- **Today marker:** a 2px `lime-700` vertical line with a small "Today" pill (`lime-100` fill, `lime-800` text) at the top. The only lime line in the component.
- **Non-working time** (weekends, holidays): `neutral-100` column background. Jobs never render into it.
- **Unassigned lane:** a pinned row at the top labelled "Unassigned" holding jobs awaiting allocation. Dragging a bar from this lane onto an employee row assigns it — planning by direct manipulation.
- **Overload signal:** if an employee's allocated hours exceed capacity for a period, that row segment's background tints amber at 8% opacity with a small ⚠ in the row header. No red, no flashing — a calm nudge.

**Job bars**

Rounded 14px bars, filled with `neutral-0`, 1px `neutral-200` border, and a slim 4px left edge in the job's status colour. Inside, exactly three items:

```
TIC-2458   ABB MCC Panel   78%
```

Progress renders as a subtle `lime-100` fill from the left, proportional to %, behind the text. No icons, no hours, no due dates, no badges inside the bar. When a bar is too narrow for all three items, drop the customer name first, then the %, keeping the job number always.

**Overlapping jobs:** when an employee has two jobs scheduled in the same period, the row splits into stacked sub-rows (each 32px) and the row grows to fit — bars never overlap, truncate, or hide behind each other. Three or more concurrent jobs on one person is itself the signal something is wrong; the overload tint (above) will already be showing.

**Long bars at Day zoom:** a bar extending beyond the visible range is clipped flat at the viewport edge (no rounded corner on the clipped end) with a small `→ continues` affordance; the job number stays pinned inside the visible portion of the bar while scrolling.

Users should understand workshop loading within seconds.

---

## 16. Timeline Behaviour — Full Gesture Model

**Desktop**

| Input | Result |
|---|---|
| Hover | Bar lifts to Shadow 1, cursor `grab` |
| Click | Job Side Panel opens |
| Drag | Move job (snaps to grid; ghost outline shows origin) |
| Drag left/right edge | Resize duration (8px handle zones) |
| Scroll / trackpad | Pan timeline |
| Keyboard | Arrow keys move focus between bars; Enter opens panel; visible focus ring |

**iPad**

| Input | Result |
|---|---|
| Tap | Job Side Panel opens |
| Long press (350ms) | Bar "picks up" (Shadow 2, 1.02 scale, light haptic) → drag to move. Timeline panning is suspended while a bar is held — this is how move and swipe coexist. |
| Long press an edge handle | Resize |
| One-finger swipe (empty area) | Pan timeline |
| Pinch | Change zoom level |

Every desktop interaction has a touch equivalent. During any drag, invalid drop zones (non-working time) show no snap target and the bar returns home on release with a 200ms ease-out.

**Undo is mandatory.** Every move or resize shows a toast — *"TIC-2458 moved to Thu 23 Jul — Undo"* — for 6 seconds, and `Ctrl/Cmd + Z` reverses the last scheduling change at any time. Drag-to-reschedule without undo is a data-loss trap; this rule is non-negotiable.

---

## 17. Job Side Panel

Clicking a job never navigates away. A panel slides in from the right (250ms ease-out), **480px wide** on desktop, full-height, Shadow 2. The timeline remains visible and dims to 92% — never blocked by a modal scrim. Esc, the ✕ button, or tapping the timeline closes it.

**Layout, top to bottom:**

1. **Header:** Job number (Card Title) + status badge, customer name (Caption), ✕ close.
2. **Progress block:** large % with a slim progress bar; Allocated / Completed / Remaining hours as three tabular figures on one line.
3. **Details:** current stage, assigned technician, material status, due date, description. Label (Helper, `neutral-500`) above value (Body) — one column, generous spacing.
4. **Notes:** most recent two, with "View all in job".
5. **Action bar (sticky footer):** `Update progress` (Primary) · `Record hours` (Secondary) · overflow menu (⋯) containing Add note, Upload document, Complete stage · `Open full job` (Ghost, full-width beneath).

Two visible buttons plus overflow keeps the panel calm; v1.0's six flat actions would have created six competing targets.

**Unsaved changes:** inline edits in the panel save on commit (blur / Enter), so there is normally nothing to lose. If a multi-field action (e.g. Record hours) is mid-entry when the user taps away or presses Esc, the panel stays open and asks once: *"Discard unsaved hours?"* `Keep editing` (Primary) · `Discard` (Ghost). Never silently discard, never silently save half-entered data.

This slide-in pattern is the standard Level Two interaction throughout the application.

---

## 18. Supporting Panels

Three equal cards below the timeline:

- **Upcoming Deliveries** — next 5 completions: job number, customer, date. Nothing more.
- **Workshop Activity** — chronological feed: "Liam completed wiring on TIC-2458 · 14:32". Plain text, relative timestamps.
- **Capacity Forecast** — one small line chart: x-axis the next 4 weeks (labelled by week commencing), y-axis 0–120% capacity, a single `lime-700` line, and a dashed `neutral-200` reference line at 100%. Weeks above 100% get a small amber dot on the line. No legend needed — the chart is self-explanatory or it is wrong.

They support the timeline. They never compete with it.

---

## 19. Buttons

Five types only. Height 44px (touch minimum), radius 12px, Body Strong label, 16px horizontal padding minimum.

| Type | Default | Hover | Pressed | Disabled |
|---|---|---|---|---|
| Primary | `lime-500` fill, `neutral-800` text | `lime-600` | `lime-700`, 0.98 scale | `neutral-100` fill, `neutral-500` text |
| Secondary | white fill, `neutral-200` border, `neutral-800` text | border `neutral-500` | `neutral-100` fill | 40% opacity |
| Ghost | text only, `neutral-800` | `neutral-100` background pill | `neutral-200` background | 40% opacity |
| Danger | `#C4302B` fill, white text | darken 8% | darken 12% | 40% opacity |
| Icon | 44×44px square, radius 12px, Ghost behaviour | as Ghost | as Ghost | 40% opacity |

All buttons: 2px `lime-800` focus ring, offset 2px, keyboard-visible. Loading state: label is replaced by a 16px spinner; width never changes (prevents layout shift).

One Primary button per view, maximum.

---

## 20. Cards

The primary organisational component. White surface, `radius-card` 16px, Shadow 1, 24px padding.

Anatomy: Title (Card Title) · optional leading icon · content · optional footer separated by a 1px `neutral-200` divider.

Consistent spacing, radius, and shadow. No exceptions, no variants.

Cards never scroll internally. If content exceeds the card, show the top items plus a `View all` Ghost link to the Level Three workspace — a scrolling card is hidden information, which violates §2.

---

## 21. Status Badges

Pill shape, 4px vertical / 8px horizontal padding, Caption weight 600, icon (14px) + label. Colours and icons come from the canonical status table in §4 — one source of truth.

Identical appearance everywhere: timeline panel, tables, job pages, notifications.

---

## 22. Tables

Never resemble Excel.

- Rounded container (`radius-container`, 20px) with the table inset inside
- Sticky header: Caption weight 600, `neutral-500`, `neutral-50` background
- Row height 56px; alternating rows `neutral-100` at 50%
- Hover: `lime-100` at 30% (desktop only — rows are fully tappable on touch)
- Whole row is the click target; opens the side panel
- Column alignment: text left, numbers right (tabular figures), status badges left
- Sortable columns show a subtle chevron on the active sort only (never on every header); tap/click the header to toggle direction
- Pagination, not infinite scroll: 25 rows per page with a simple `‹ 1 2 3 ›` control — planners need stable positions they can return to
- Built to accept inline editing later without visual change

---

## 23. Forms

- Inputs: 48px height (floating labels need the extra 4px of breathing room over the 44px touch minimum), radius 12px, 1px `neutral-200` border; focus = `lime-700` border + `lime-800` focus ring
- Floating labels preferred; label animates to top on focus/fill (150ms)
- Logical grouping, minimal fields, 16px between fields, 32px between groups
- Validation inline, beneath the field: Helper size, red text + ⚠ icon, appears on blur, never on first keystroke
- Error message states the fix: *"Enter a due date after today"*, not *"Invalid date"*

---

## 24. Search

Universal search in the header. `Ctrl/Cmd + K` opens it anywhere.

Results appear while typing, grouped: Jobs · Customers · Employees · Materials · Drawings · Purchase Orders · Documents · Recent. Maximum 5 results per group with a `See all N results` row when more exist. Each result row: icon + primary text + Caption context (e.g. "TIC-2458 · ABB MCC Panel · In Progress"). Enter opens; arrow keys navigate. Empty query shows recent activity. On iPad (no reliable keyboard shortcut) the header search icon is the entry point — same overlay, same behaviour; `Cmd + K` still works when a hardware keyboard is attached.

---

## 25. Notifications

Every notification includes an action. Never simply display information.

```
⚠ Missing contactors — TIC-2458
[Create purchase order]  [View job]  [Dismiss]
```

Toast notifications: bottom-right (desktop) / top (iPad), Shadow 2, auto-dismiss after 6s unless they carry a destructive or required action. Maximum two visible; further ones queue. The notification centre (bell) keeps the full actionable list.

**Two priority levels only.** *Interrupting* (toast + bell): blocked jobs, missed material, anything stopping production today. *Passive* (bell only): completions, notes, progress updates. If everything interrupts, nothing does.

The interface encourages action.

---

## 26. Empty States

Never a blank page. Every empty state has: a quiet illustration or icon (neutral, single-colour), one reassuring sentence, and — where creation is possible — one action.

- Timeline, no jobs: *"No jobs scheduled this week. Everything is running to plan."* + `Schedule a job`
- Attention filter, all clear: *"No production issues detected."*
- Search, no results: *"Nothing found for 'contactor 3RT'. Check the spelling or try a job number."*

Empty states reassure.

---

## 27. Loading States

Never blank screens. Skeleton loaders mirror the real layout: grey bars (`neutral-100`, shimmer at 1.2s) in the exact positions of timeline rows, cards, and table rows. Content replaces skeletons with a 150ms fade. Anything under 300ms skips the skeleton entirely — no flash.

---

## 28. Error Messages

Plain English. No technical terminology. Always a recovery action.

| Never | Instead |
|---|---|
| "Error 500: request failed" | "Something went wrong saving your changes. **Try again**" |
| "Invalid input" | "Hours must be a number, like 7.5" |
| "Connection lost" | "You're offline. Changes will save when you reconnect." |

Errors don't apologise and are never vague.

---

## 29. Motion

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | 150ms | Hovers, fades, label float |
| `duration-base` | 200ms | Sidebar, expand/collapse |
| `duration-slow` | 250ms | Side panel slide |
| `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Everything |

Permitted: fade, slide, expand, collapse, subtle hover lift (2px translate + Shadow 1).
Forbidden: bounce, flash, heavy scaling, decorative animation.

Motion communicates state changes only. `prefers-reduced-motion` disables all movement; state changes become instant fades.

---

## 30. Responsive Behaviour

Primary: desktop (≥1280px). Secondary: iPad (landscape 1024–1279px, portrait supported).

- Touch designed in from day one; every desktop interaction has a touch equivalent (§16)
- Minimum touch target: 44×44px, everywhere, no exceptions
- No hover-only functionality — anything revealed on hover is also reachable by tap or focus
- iPad landscape: sidebar defaults to collapsed; supporting panels stack two-then-one
- iPad portrait: timeline switches to Day/Week zoom only; supporting panels stack vertically
- **Phone (<768px): read-only companion.** Status banner, attention list, and job lookup with the side panel as a full-screen sheet. No timeline editing — drag scheduling on a phone would be guesswork, and pretending otherwise would ship a bad experience. The nav collapses to a bottom tab bar (Dashboard · Jobs · Search · Notifications).

---

## 31. Accessibility

- Contrast: WCAG AA minimum — 4.5:1 body text, 3:1 large text and UI borders. All tokens in §4 pass on their defined backgrounds.
- Full keyboard navigation, including the timeline (§16)
- Focus ring: 2px `lime-800`, 2px offset, never removed
- Status = colour **plus** icon **plus** label, always
- Readable typography, comfortable spacing, `prefers-reduced-motion` respected
- **Timeline screen-reader model:** the timeline exposes an ARIA grid — rows labelled by employee, cells by date; each job bar is a focusable `gridcell` announced as *"TIC-2458, ABB MCC Panel, 78 percent complete, Monday 20 to Thursday 23 July, assigned to Liam"*. Arrow keys move focus, Enter opens the side panel, and moves made by keyboard announce their result via a live region. A visual-only timeline is not an option.

---

## 32. Component Reuse

Claude Code must build one of each: Job Bar · Button system · Badge system · Card · Dialog · Side Panel · Table · Form field · Empty state · Skeleton.

Every screen reuses these. Never create visually different versions of the same component. If a screen appears to need a variant, the screen is wrong, not the component.

---

## 33. Information Hierarchy — One Hero Per Screen

| Screen | Hero |
|---|---|
| Dashboard | Production Timeline |
| Production | Production Timeline (expanded) |
| Jobs | Job list |
| Materials | Material status list |
| Workshop | Employee board |
| Reports | Primary chart |
| Settings | Settings groups |

Nothing competes with the hero.

---

## 34. The Three Second Rule

A new user should understand every screen within three seconds: where they are, what the screen does, what needs attention, what to do next.

If not achieved, simplify. The test: show the screen to a colleague who has never seen it for three seconds, then take it away — if they can't answer those four questions, redesign. One number, one test.

---

## 35. Touch First Thinking

Merged into §16 (gesture model) and §30 (responsive behaviour) — one home per rule. Retained here only so section numbering stays stable: large spacing, comfortable buttons, no tiny controls, no hidden interactions, no desktop-only workflows.

---

## 36. Production Planner Philosophy

The application behaves like an intelligent digital workshop planning board. **The production planner is the product.** Everything else supports it.

When users open the software, their attention goes straight to the timeline. The interface feels calm, organised, effortless. Users stop thinking about software and start thinking about production.

---

## 37. Future Compatibility

The token system (§4–§9) *is* the scalability mechanism. Future modules import the same tokens and components and inherit the identity automatically. No future module will require a visual redesign — only new content in existing containers. Future modules may **add** tokens; they may never redefine an existing one.

### Theming decision

**Light mode is the only theme in v1.** Dark mode is explicitly deferred — designing two themes before one screen exists doubles the work on the riskiest phase, and a workshop planning tool used in daylight doesn't need it at launch.

The architecture already guarantees it stays cheap to add later. Three rules keep that promise:

1. Components reference **semantic tokens only** (§4) — any raw hex value in component code is a bug, not a shortcut.
2. Shadows, like colours, are theme tokens (§8).
3. No component may assume a light background in its logic (e.g. hard-coded white overlays).

When dark mode arrives, it is a new token file plus a switch — nothing else changes. Do not build a theme toggle in v1; build the discipline that makes the toggle trivial in v2.

---

## 38. Final Design Rules for Claude Code

- Always prioritise clarity over density
- Always choose whitespace over clutter
- Always use tokens and reusable components — never raw hex, never one-off styles
- Always maintain one visual hero per screen
- Always design for desktop and touch simultaneously
- Never imitate traditional ERP software
- Never make the interface resemble a spreadsheet
- Never overload the production timeline with information
- Never introduce inconsistent styling
- Never sacrifice usability for aesthetics
- Never use: dense tables, tiny buttons, excessive colours, pop-up overload, hover-only functionality, or multiple competing focal points

The final result should look like a modern premium SaaS platform built specifically for managing the production of electrical control panels. Shown without branding, a screenshot should be immediately recognisable as high-quality commercial software rather than a bespoke internal tool.
