# ESD Production Planner — Specification

| | |
|---|---|
| **Document version** | v0.4 (Draft) |
| **Status** | For review — Andrew / Liam |
| **Date** | 14 July 2026 |
| **Related documents** | TIC ERP Replacement — Master Project Plan v1.3 |
| **Project type** | Standalone side project / learning build |

---

## 1. Purpose

The ESD Production Planner is a standalone, cloud-architecture web tool (initially self-hosted) for scheduling and tracking work through the Engineered Services Division workshop. It answers three questions no current TIC system answers well: what builds are in the workshop and what state are they in, whether labour capacity exists to hit committed dates, and how actual hours booked compare to estimated hours — including overtime.

The tool is scoped as a self-contained side project. Its primary purpose is practical (ESD gets a working planner months before the full ERP lands, and a structured build-history archive it has never had), but its secondary purpose is developmental: it is a training ground for the patterns the ERP depends on — Supabase schema design with Row Level Security, role-based permissions, file storage, responsive desktop/tablet UI, real-time updates, and two-developer Git workflow with Claude Code. The data model and conventions are designed to be absorbed into the ERP's ESD module rather than thrown away.

## 2. Background

ESD manufactures control panels and assemblies. Production planning today is informal — OrderWise order lines, spreadsheets, and conversation. There is no single view of workshop load, no structured record of who worked on which build for how long, no organised per-build document repository, and no way to look up what happened the last time a given part was built. The planner runs **in tandem with OrderWise** during its life: each build records its OrderWise sales order references so the two systems can be cross-referenced, until the ERP replaces OrderWise entirely.

The estimated-versus-actual hours data (including overtime classification) this tool captures is a prerequisite for the master plan's Monthly Performance Analysis, which tracks ESD margin at three stages (Estimated → Engineered → Production/Despatched).

## 3. Relationship to the ERP programme

Standalone-first, merge-later. The planner runs in its own repository and its own database with no integration to OrderWise or the ERP build, but adopts ERP conventions from day one so the eventual merge is a data migration, not a redesign:

The **business-unit dimension** appears on every transactional record, defaulting to `ESD`. **Labour phases** are the agreed three — Mechanical, Electrical, Inspection. **Builds are identified by BU numbers** per the BU-series convention. **Per-worker cost rates and money are excluded**: the planner records hours only, classified as standard, overtime 1.5x (Mon–Sat outside standard hours), or overtime 2x (Sunday), so Finance can apply rates externally. Actual £ rates, margins, quoting, and MPA calculation stay in the existing Excel process until the ERP's ESD module replaces them, keeping the restricted finance permission tier out of this tool's scope.

The software stack matches the ERP's (Supabase, Next.js/React, GitHub, Claude Code) but the **hosting model deliberately diverges**: developed locally on the developers' machines, deployed self-hosted on the office server for in-building and VPN access. Because the application code is identical either way, the planner could be re-pointed at Supabase Cloud with configuration changes only — which is also the merge path into the ERP.

## 4. Users and roles

Four roles:

**Admin** — Andrew (Engineering Manager) and Liam (Engineered Services Manager), who are also the two developers. Everything: all Commercial capabilities plus user and role management, clocking corrections (adjusting, adding, or deleting time entries to fix mis-clocks and forgotten clock-offs, with an audit trail), reference data, and system configuration.

**Commercial** — Sophie Clark (Commercial Engineer). Supports order handover into the schedule: create and edit customers, projects, parts, and builds; enter order information at order placement; build and adjust the schedule; manage workers, calendars, and holidays; view all reports. Effectively full operational control, without user management or clocking corrections.

**Workshop** — Sophie Clark's ESD colleagues on the floor (Kai Truscott, Dave Atkinson, Lewis Cuthbert). Shopfloor interface only: view assigned work, clock on and off, flag blocks.

**Viewer** — Richard Whalley (QA oversight), Peter Atkinson, Jamie Dickinson. Read-only schedule and reports.

**People are both users and workers.** Andrew, Liam, and Sophie are all allocated production tasks from time to time, so the model separates *system users* (login + role) from *workers* (a schedulable labour resource), with an optional link between them. Anyone can appear on the scheduling board and clock on to work regardless of their system role.

## 5. Scope

### In scope

A **customer and project register** so every build belongs to a customer, optionally grouped into a project, and all builds can be viewed and analysed per customer and per project. A **part register** so recurring builds of the same part number are linked, and the scheduler can refer back to the last time a part was built — its documents, hours, and outcome. A **build register** (BU numbers) carrying order metadata and OrderWise cross-references. **Material readiness tracking** per build: a materials-complete flag plus outstanding component lines with expected delivery dates, maintained by Commercial for shopfloor and manager visibility. A **document repository** per build (PDFs, drawings, and related files) held in the app's own storage. A **notes and activity log** per build with attachments (red-pen drawings, photos). A **scheduling board** assigning phase operations to workers with load-versus-capacity visibility, including schedulable overtime. A **capacity model** from workers, the standard working day, and a holiday calendar. A **shopfloor clocking interface** (shared PC first, tablets later). **Reporting** on estimated versus actual hours with overtime classification, per build, customer, project, part, worker, and period, plus a materials due/overdue view.

### Out of scope

Money: cost rates, margins, quoting, MPA calculation (the planner produces the hours data MPA needs, not the analysis). Material and stock management, purchasing, BOM management (the ESD OrderWise sales order remains the BOM record for now). Live integration with OrderWise or Sage — cross-references are manually entered. QA inspection sign-off — deferred to the ERP by agreement. Native mobile apps — tablet use is the responsive web app.

## 6. Functional requirements

### 6.1 Customers, projects, and parts

**Customers** are saved records (name, optional contact notes) created by Commercial/Admin, so all builds for a customer can be listed and analysed together. **Every BU number relates to an external customer's order, so customer is a mandatory field on every build.** **Projects** optionally group builds beneath a customer (a customer may place many orders under one project), giving a project-level view of builds, hours, and history. **Parts** are saved records (part number, description) that persist across orders: a part may be built many times, and each build links to its part, so from any build the scheduler can open the full build history of that part number — previous BU numbers, dates, actual hours, and documents — to inform estimating and building the current one.

### 6.2 Builds (BU register)

A **build** is the unit of work, identified by a unique BU number. Each build records: part number (link to part register), customer, optional project, **order number**, **date order received**, **requested delivery date**, **OrderWise sales order reference** (the single-line SO carrying the part number), and **internal ESD OrderWise sales order reference** (the full build BOM) — the two references keeping the planner usable in tandem with OrderWise. Each build carries a priority and a **status** from a configurable list, initially: **Order** (ordered, not yet picked) → **Part-Picked** (some parts issued for production) → **Picked** (all parts issued for production) → **In-Build** → **On-hold** → **Ready for despatch**. Statuses are held as reference data so more can be added later without code changes; some transitions are automatic (In-Build when the first operation is clocked on) with manual override.

Each build contains **phase operations** — Mechanical, Electrical, Inspection — each with estimated hours and its own status. **Phases are not strictly sequential:** Mechanical and Electrical routinely run concurrently, and a worker may be assigned to both Mechanical and Electrical tasks within the same period, so the model imposes no ordering constraint by default (an optional dependency can be set where one genuinely exists, e.g. Inspection after both).

### 6.3 Materials readiness

Each build carries a **materials-complete flag**, set manually by Commercial (typically Sophie) when all materials are booked in to allow completion. The flag is deliberately manual rather than derived, because not every component will be listed — the detail exists for exceptions worth communicating. Beneath the flag, **material lines** record outstanding items: component part number (free text — bought-in components stay out of the ESD parts register), description, expected delivery date, and a booked-in tick with date. Builds routinely start with some components outstanding, so material status is **informational, not blocking**: it appears as a badge on the scheduling board and build screens, and it never prevents scheduling — the exceptional case (e.g. the enclosure itself not arrived) is handled by the scheduler simply not placing the work, informed by the badge and the due/overdue view (6.8).

### 6.4 Capacity, working day, and overtime

The standard working day is **07:30–16:00 with a 12:00–13:00 break: 7.5 productive hours**, Monday to Friday. Each worker has one or more phase competencies (Mechanical, Electrical, Inspection). A holiday calendar records approved leave and company closure days. Available standard capacity for any day/week/phase is derived from these.

**Overtime is schedulable.** Any work outside the standard window — before 07:30, after 16:00, Saturdays, Sundays — is overtime. The scheduler can create overtime assignments explicitly, and the load view shows standard and overtime capacity separately. Overtime hours are classified for reporting as **1.5x (Monday–Saturday)** or **2x (Sunday)**; the tool stores hours and classification only, never £ values, so Finance applies rates externally.

### 6.5 Scheduling board

The main desktop screen shows workers as rows and days as columns over a selectable week or month horizon. Phase operations are dragged from an unscheduled backlog onto worker/day cells to create assignments (an operation can be split across days or workers; concurrent Mechanical and Electrical assignments on the same build are normal). The board colour-codes by priority and flags conflicts: assignment on a holiday, worker assigned outside their phase competencies, a standard day loaded beyond 7.5 hours without an overtime assignment, or scheduled completion later than the requested delivery date. Each build shows a **material badge** — complete, awaiting (with latest expected date), or not recorded — as information for the scheduler, with no scheduling restriction attached. A **load view** charts committed hours (standard and overtime separately) against capacity per phase per week.

### 6.6 Shopfloor clocking

**Initial implementation — shared PC.** Until tablets are introduced, the shopfloor interface runs on one shared laptop or desktop PC in the workshop. The clocking screen presents a **dropdown to select worker name** and a **dropdown/search to select the BU number** (filtered to builds in clockable statuses), with clock-on and clock-off actions against the relevant phase operation. Clocking on to a new operation automatically clocks off the previous one; an automatic end-of-shift clock-off catches forgotten clock-offs and flags the entry for review. Workers can flag an operation as blocked with a short reason, surfacing immediately on the scheduling board.

**Admin corrections.** Admins can adjust, add, or delete clockings to fix mis-clocks, wrong-BU selections, and forgotten clock-ons. Every correction retains the original values and records who changed what and when. During shopfloor trials the workspace is shared and clockings may be **wholly managed at admin level** (admins entering time on workers' behalf) until the tool is deployed for direct use — the interface supports both modes without configuration.

**Later — tablets.** The same responsive interface serves iPads at benches or wall-mounted. The desktop-first design must adapt cleanly to tablet layout (see 8).

### 6.7 Documents

Each build has a **document repository**: PDFs, drawings, photos, and other files uploaded against the BU number and stored in the app's own storage (Supabase Storage). Clicking into a build shows its documents alongside its details. Because builds link to parts, opening a part's build history exposes the documents from every previous build of that part — this is the "refer back to the last build" workflow and a key reason customers and parts are first-class records. Documents can also be attached to notes (6.9), in which case they appear both in the build's repository and inline with the note that raised them. Upload and delete are Commercial/Admin actions (Workshop can attach photos/PDFs to their own notes); Workshop and Viewer roles can view and download.

### 6.8 Reporting

The **build progress report**: per build, estimated versus actual hours by phase, percentage complete, projected overrun. The **utilisation report**: per worker or phase over a period, hours booked (split standard / OT 1.5x / OT 2x) against hours available. The **schedule adherence view**: builds whose scheduled completion falls after the requested delivery date. The **materials due/overdue view**: all outstanding material lines across live builds, sorted by expected delivery date with overdue lines flagged — Sophie's chase list and the managers' early warning. **Customer and project analysis**: builds, hours, and adherence rolled up per customer and per project. All reports export to CSV to feed the existing Excel costing/MPA process, with overtime classification included so Finance can apply the 1.5x/2x rates.

### 6.9 Notes and activity log

Each build carries a timestamped **notes log** — who, when, free text — covering chase updates, customer conversations, scheduling decisions, and workshop observations, mirroring the chase-notes pattern already agreed for the ERP's quotations. Notes accept **attachments**: red-pen drawings, photos, and PDFs captured against the note, stored alongside the build's documents. All roles except Viewer can add notes (Workshop included, so red-pen markups can be captured at the bench); notes are append-only, with Admin able to hide an erroneous entry rather than delete it, preserving the record.

## 7. Data model

All tables carry `id` (uuid), `created_at`, `updated_at`. Transactional tables carry `business_unit` (text, default `'ESD'`).

| Table | Key fields | Notes |
|---|---|---|
| `customers` | name, notes, active | |
| `projects` | customer_id, name, notes | Optional grouping of builds |
| `parts` | part_number, description | part_number unique; the recurring-build anchor |
| `builds` | bu_number, part_id, customer_id (required), project_id (nullable), order_number, order_received_date, requested_delivery_date, ow_sales_order_ref, ow_esd_sales_order_ref, status_id, priority, materials_complete (bool, manual) | bu_number unique |
| `material_items` | build_id, component_part_number (free text), description, expected_delivery_date, booked_in (bool), booked_in_date | Outstanding-component lines; free text keeps bought-in parts out of the ESD parts register |
| `build_statuses` | code, name, sequence, clockable (bool) | Seeded: Order, Part-Picked, Picked, In-Build, On-hold, Ready for despatch; extensible |
| `notes` | build_id, author_id, body, hidden (bool) | Append-only; Admin can hide, not delete |
| `phases` | code, name | Seeded: MECH, ELEC, INSP |
| `operations` | build_id, phase_id, description, estimated_hours, status, blocked, blocked_reason, depends_on (nullable) | No default sequencing |
| `workers` | name, active, standard_day (jsonb), user_id (nullable) | Link to auth user optional — Andrew/Liam/Sophie are both |
| `worker_phases` | worker_id, phase_id | Competency, many-to-many |
| `assignments` | operation_id, worker_id, date, planned_hours, overtime (bool) | Board writes these; OT flag drives capacity display |
| `time_entries` | operation_id, worker_id, started_at, ended_at, ot_class (none/1.5/2.0, derived), auto_closed, adjusted_by (nullable), adjusted_at, original_values (jsonb) | OT class derived from times/day; corrections audited in place |
| `holidays` | worker_id (nullable = company-wide), date_from, date_to, note | |
| `documents` | build_id, note_id (nullable), filename, storage_path, uploaded_by, file_type, size | Files in Supabase Storage; note_id links attachments to their note |

Row Level Security: Admin full access; Commercial full read/write except users and time-entry corrections; Workshop reads builds/operations/assignments and inserts time entries; Viewer read-only. The shared shopfloor PC runs under a dedicated kiosk login with Workshop-level policies — worker identity comes from the dropdown selection recorded on each entry, not from the login.

## 8. Non-functional requirements

**Stack:** Supabase (Postgres, Auth, RLS, Realtime, Storage) self-hosted via Docker; Next.js App Router with React, containerised with `output: 'standalone'`; GitHub repository shared between both developers.

**Desktop-first, tablet-capable.** Desktop is the primary interface and carries the heavy work: build and order entry, scheduling, resource allocation, documents, reports. The layout must **adapt responsively to tablet** for the shopfloor views (clocking, my-work, blocked flags) with touch-friendly targets. This requirement is to be written into the repository README and **CLAUDE.md** so Claude Code applies it consistently: desktop-first layouts, with shopfloor routes designed mobile/tablet-first, tested against iPad Safari dimensions.

**Realtime:** the scheduling board subscribes to time entry and blocked-flag changes so it is live without refresh. **Devices:** desktop browsers for Admin/Commercial/Viewer; the shared workshop PC for clocking initially; iPad Pro M2 as the tablet test device for later rollout. **Data protection:** time entries are personal data; access is role-restricted, corrections are audited, and the tool records hours for planning, not disciplinary monitoring — to be stated to the team at rollout. During development on personal hardware, only test/seed data is used; real clockings begin once the system is on company infrastructure. **Backups:** nightly `pg_dump` plus the storage bucket, copied to the office NAS once deployed; quarterly restore test.

## 8a. Environments and deployment

**Development (local).** Each developer runs the full stack on their own machine: Docker Desktop (WSL2) plus the Supabase CLI — `supabase start` launches Postgres, Auth, Realtime, Storage, and Studio locally; `npm run dev` serves the app. Development is currently on Andrew's personal PC (Docker Desktop and WSL2 confirmed working, GitHub connected), with Liam reproducing the identical stack from the repository. Database changes are made exclusively through migration files committed to Git; seed data lives in `supabase/seed.sql`; all connection details come from environment variables so the same codebase runs against any environment unchanged. WSL2 containers are the same Linux containers the production VM will run, so nothing built locally is specific to the development machines.

**Production (office server) — parked pending Lane Systems.** The office server is Windows-based and managed by Lane Systems; all Lane Systems asks are to be revisited when the tool is ready for mass use. The working plan remains an **Ubuntu Server VM under Hyper-V** on the existing Windows host (~4 vCPU, 16 GB RAM, 60 GB disk, subject to headroom), running Docker Compose with the self-hosted Supabase stack, the app container, and a Caddy reverse proxy behind an internal DNS name (e.g. `planner.tic.internal`); VPN users reach the same address. Migration from development is: stand up the VM, install Docker Engine, clone the repository, set production environment variables and fresh secrets, start the stack, and restore a `pg_dump` (plus storage files) of any data to carry over. Deployment of new versions: pull, rebuild the app container, apply migrations.

**Environment parity** is the governing principle: the only differences between a developer machine and the server are environment variables and secrets. Recorded fallback if self-hosted Supabase proves too heavy: plain Postgres with Auth.js and Drizzle ORM, at the cost of RLS/Realtime/Storage learning that transfers to the ERP.

## 9. Build plan

Each phase produces something usable. Everything through Phase 4 happens on the developers' machines; Lane Systems and the server are not involved until Phase 5.

**Phase 0 — Development environment (a few days).** Repository with README and CLAUDE.md (conventions, desktop-first/tablet-adaptive requirement, migration workflow), `.env.example`, first migration, seed file. Liam verifies he can reproduce the stack from the repo alone. Objective: prove the two-developer, migrations-in-Git workflow before writing features.

**Phase 1 — Foundations (1–2 weeks).** Core schema migrations; Auth with the four roles; RLS policies; CRUD screens for customers, projects, parts, and builds including order metadata, OrderWise references, statuses, and material readiness (flag plus outstanding lines). Objective: prove auth/RLS end to end and give Sophie's order-handover workflow its first home.

**Phase 2 — Capacity and schedule (2–3 weeks).** Workers (including user-linked workers), phase competencies, calendars, holidays; the scheduling board with drag-and-drop, concurrent Mechanical/Electrical assignment, overtime assignments, conflict flagging; the load view with standard/OT split. Objective: first genuinely useful screen; complex client-side state against Supabase.

**Phase 3 — Shopfloor and documents (2 weeks).** Shared-PC clocking screen (worker dropdown, BU selection, clock on/off, blocked flags, auto clock-off), admin clocking corrections with audit, the per-build document repository on Supabase Storage, and the notes log with attachments. Objective: Realtime, Storage, and the correction/audit pattern.

**Phase 4 — Reporting and local trial (1–2 weeks).** The five reports including the materials due/overdue view, OT classification, CSV export, edge cases (estimate changes mid-build, correction flows), and a trial period served from a developer PC with admin-managed clockings.

**Phase 5 — Server deployment (1 week, with Lane Systems).** Revisit the Lane Systems asks: Hyper-V VM (or alternative they prefer), internal DNS, VPN routing; stand up the stack, production secrets, restore-from-backup test, remote access check; cut the workshop PC over to the server address and run live.

Total: roughly 8–11 weeks at side-project pace.

## 10. Merge path to the ERP

When the ERP's ESD module is built, `customers`, `projects`, `parts`, `builds`, `operations`, `workers`, `holidays`, `time_entries`, and `documents` migrate into the ERP schema — the customer and part registers seed the ERP's masters rather than being discarded. The clocking interface is expected to carry over largely intact. The ERP then layers on what this tool deliberately excludes: per-worker cost rates behind the finance permission tier, the Labour Times reference table driving estimates, MPA margin calculation, quotations, QA inspection sign-off (deferred from this tool by agreement), and full document control with structured returns.

## 11. Open questions

Whether the shared shopfloor PC needs any identity check beyond dropdown selection (a PIN can be added later if mis-selection becomes a problem). Whether part revision levels need tracking now or at the ERP stage (recommendation: a free-text revision field on the build for now). Document size/type limits for the repository and note attachments. Lane Systems deployment asks — parked by agreement, to be revisited when ready for mass use: Hyper-V headroom or alternative hardware, VM administration model, internal DNS, VPN routing.

---

*Change log: v0.1 — initial draft. v0.2 — hosting changed to local development with self-hosted office-server deployment; environments/deployment section added; build plan gained Phase 0 and Phase 5. v0.3 — customers, projects, and parts added as first-class records with build-history lookup; builds gain order metadata and OrderWise SO cross-references; configurable status list; concurrent Mechanical+Electrical phases; working day defined as 07:30–16:00 less 12:00–13:00 (7.5h); schedulable overtime with 1.5x/2x classification in reporting; shopfloor interface revised to shared-PC dropdown clocking with admin corrections and audit; per-build document repository added to scope; roles revised to Admin (Andrew, Liam) / Commercial (Sophie) / Workshop / Viewer with users-as-workers support; QA sign-off formally deferred to ERP; Lane Systems asks parked; desktop-first/tablet-adaptive requirement to be encoded in README and CLAUDE.md. v0.4 — customer made mandatory on every build (all BU numbers relate to external customer orders; internal-customer assumption removed); materials readiness added: manual materials-complete flag plus outstanding component lines with expected delivery dates, informational badge on the board (no scheduling restriction), materials due/overdue view added to reporting; Part-Picked status added and Picked defined as all parts issued for production; notes and activity log per build added with red-pen/photo/PDF attachments, append-only with Admin hide.*
