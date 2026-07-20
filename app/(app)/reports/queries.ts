import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/schedule";
import { workerCapacity, type HolidayLite } from "@/lib/capacity";

// Report queries (spec §6.8). Each report has ONE query function used by
// both the screen and its CSV route, so an exported figure can never differ
// from the one on screen.
//
// Hours come from active_time_entries.worked_minutes — clock time net of the
// unpaid break, and voided entries already excluded. The tool reports hours
// and overtime classification only, never rates: Finance applies 1.5x/2x
// externally, so nothing here multiplies anything.

export type PhaseProgress = {
  phase: string;
  estimatedMinutes: number;
  actualMinutes: number;
};

export type BuildProgressRow = {
  buildId: string;
  buNumber: string;
  customer: string;
  part: string;
  status: string;
  requestedDelivery: string | null;
  phases: PhaseProgress[];
  estimatedMinutes: number;
  actualMinutes: number;
  // A finished operation counts what it really took; an unfinished one is
  // assumed to still need at least its estimate.
  projectedMinutes: number;
  percentComplete: number | null;
  overrunMinutes: number;
};

export async function buildProgress(): Promise<BuildProgressRow[]> {
  const supabase = await createClient();

  const [{ data: builds }, { data: entries }] = await Promise.all([
    supabase
      .from("builds")
      .select(
        `id, bu_number, requested_delivery_date,
         customers(name), parts(part_number), build_statuses(name, code),
         operations(id, estimated_hours, status, phases(code))`
      )
      .order("bu_number"),
    supabase
      .from("active_time_entries")
      .select("operation_id, worked_minutes"),
  ]);

  const actualByOperation = new Map<string, number>();
  for (const e of entries ?? []) {
    if (!e.operation_id || !e.worked_minutes) continue;
    actualByOperation.set(
      e.operation_id,
      (actualByOperation.get(e.operation_id) ?? 0) + e.worked_minutes
    );
  }

  return (builds ?? []).map((b) => {
    const byPhase = new Map<string, PhaseProgress>();
    let estimatedMinutes = 0;
    let actualMinutes = 0;
    let projectedMinutes = 0;

    for (const op of b.operations) {
      const phase = op.phases?.code ?? "—";
      const est = Math.round(Number(op.estimated_hours) * 60);
      const act = actualByOperation.get(op.id) ?? 0;

      const row = byPhase.get(phase) ?? {
        phase,
        estimatedMinutes: 0,
        actualMinutes: 0,
      };
      row.estimatedMinutes += est;
      row.actualMinutes += act;
      byPhase.set(phase, row);

      estimatedMinutes += est;
      actualMinutes += act;
      projectedMinutes += op.status === "Complete" ? act : Math.max(act, est);
    }

    return {
      buildId: b.id,
      buNumber: b.bu_number,
      customer: b.customers?.name ?? "—",
      part: b.parts?.part_number ?? "—",
      status: b.build_statuses?.name ?? "—",
      requestedDelivery: b.requested_delivery_date,
      phases: [...byPhase.values()].sort((x, y) =>
        x.phase.localeCompare(y.phase)
      ),
      estimatedMinutes,
      actualMinutes,
      projectedMinutes,
      percentComplete:
        estimatedMinutes > 0
          ? Math.round((actualMinutes / estimatedMinutes) * 100)
          : null,
      overrunMinutes: Math.max(0, projectedMinutes - estimatedMinutes),
    };
  });
}

export type MaterialLineRow = {
  id: string;
  buNumber: string;
  buildId: string;
  customer: string;
  status: string;
  componentPartNumber: string;
  description: string | null;
  expectedDelivery: string | null;
  requestedDelivery: string | null;
  daysOverdue: number | null;
};

// Sophie's chase list and the managers' early warning: everything still
// outstanding on a build that has not shipped, soonest first, with anything
// past its expected date flagged. Material status never blocks scheduling
// (CLAUDE.md rule 7) — this reports, it does not gate.
export async function materialsDue(): Promise<MaterialLineRow[]> {
  const supabase = await createClient();
  const todayStr = today();

  const { data } = await supabase
    .from("material_items")
    .select(
      `id, component_part_number, description, expected_delivery_date,
       builds!inner(id, bu_number, requested_delivery_date,
                    customers(name), build_statuses!inner(name, code))`
    )
    .eq("booked_in", false)
    .neq("builds.build_statuses.code", "READY_DESPATCH");

  const rows: MaterialLineRow[] = (data ?? []).map((m) => {
    const expected = m.expected_delivery_date;
    const daysOverdue =
      expected && expected < todayStr
        ? Math.floor(
            (new Date(`${todayStr}T00:00:00Z`).getTime() -
              new Date(`${expected}T00:00:00Z`).getTime()) /
              86_400_000
          )
        : null;

    return {
      id: m.id,
      buildId: m.builds?.id ?? "",
      buNumber: m.builds?.bu_number ?? "—",
      customer: m.builds?.customers?.name ?? "—",
      status: m.builds?.build_statuses?.name ?? "—",
      componentPartNumber: m.component_part_number,
      description: m.description,
      expectedDelivery: expected,
      requestedDelivery: m.builds?.requested_delivery_date ?? null,
      daysOverdue,
    };
  });

  // Soonest expected first; lines with no date at all sort last, since an
  // unknown delivery is a different problem from an imminent one.
  return rows.sort((a, b) => {
    if (a.expectedDelivery && b.expectedDelivery) {
      return a.expectedDelivery.localeCompare(b.expectedDelivery);
    }
    if (a.expectedDelivery) return -1;
    if (b.expectedDelivery) return 1;
    return a.buNumber.localeCompare(b.buNumber);
  });
}

// ── Utilisation (spec §6.8) ───────────────────────────────────────
// Hours booked over a period, split by overtime class, against hours
// available. The split comes from active_time_entry_segments, so a shift
// running past 16:00 contributes to both standard and premium rather than
// landing wholly in one bucket.

export type UtilisationRow = {
  key: string;
  label: string;
  standardMinutes: number;
  ot15Minutes: number;
  ot2Minutes: number;
  availableMinutes: number;
  utilisation: number | null;
};

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Guard against a reversed or absurd range rather than looping forever.
  for (let i = 0; cursor <= to && i < 400; i++) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export async function utilisation(
  from: string,
  to: string,
  by: "worker" | "phase"
): Promise<UtilisationRow[]> {
  const supabase = await createClient();
  const dates = datesBetween(from, to);

  const [{ data: segments }, { data: workers }, { data: holidays }, { data: phases }] =
    await Promise.all([
      supabase
        .from("active_time_entry_segments")
        .select("worker_id, ot_class, minutes, operation_id, segment_date")
        .gte("segment_date", from)
        .lte("segment_date", to),
      supabase
        .from("workers")
        .select("id, name, active, worker_phases(phases(code))")
        .order("name"),
      supabase
        .from("holidays")
        .select("worker_id, date_from, date_to, part_of_day")
        .lte("date_from", to)
        .gte("date_to", from),
      supabase.from("phases").select("code, name").order("code"),
    ]);

  // Segments carry the worker but not the phase, so map operations to phases.
  const { data: operations } = await supabase
    .from("operations")
    .select("id, phases(code)");
  const phaseByOperation = new Map(
    (operations ?? []).map((o) => [o.id, o.phases?.code ?? "—"])
  );

  const holidayList = (holidays ?? []) as HolidayLite[];
  const buckets = new Map<string, UtilisationRow>();

  function bucket(key: string, label: string): UtilisationRow {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: UtilisationRow = {
      key,
      label,
      standardMinutes: 0,
      ot15Minutes: 0,
      ot2Minutes: 0,
      availableMinutes: 0,
      utilisation: null,
    };
    buckets.set(key, created);
    return created;
  }

  if (by === "worker") {
    for (const w of workers ?? []) {
      const row = bucket(w.id, w.name);
      // Inactive workers still appear if they booked time in the period,
      // but carry no forward capacity.
      row.availableMinutes = w.active
        ? Math.round(workerCapacity(w.id, dates, holidayList) * 60)
        : 0;
    }
  } else {
    for (const p of phases ?? []) {
      const row = bucket(p.code, p.name);
      // Phase capacity counts every worker competent in it, so phases
      // overlap — the same caveat the load view carries.
      row.availableMinutes = (workers ?? [])
        .filter(
          (w) =>
            w.active &&
            w.worker_phases.some((wp) => wp.phases?.code === p.code)
        )
        .reduce(
          (sum, w) => sum + Math.round(workerCapacity(w.id, dates, holidayList) * 60),
          0
        );
    }
  }

  for (const s of segments ?? []) {
    if (!s.minutes) continue;
    const key =
      by === "worker"
        ? s.worker_id
        : phaseByOperation.get(s.operation_id ?? "") ?? "—";
    if (!key) continue;

    const label =
      by === "worker"
        ? (workers ?? []).find((w) => w.id === key)?.name ?? "Unknown"
        : (phases ?? []).find((p) => p.code === key)?.name ?? key;

    const row = bucket(key, label);
    if (s.ot_class === "2.0") row.ot2Minutes += s.minutes;
    else if (s.ot_class === "1.5") row.ot15Minutes += s.minutes;
    else row.standardMinutes += s.minutes;
  }

  return [...buckets.values()]
    .map((r) => ({
      ...r,
      // Standard hours against standard capacity: overtime sits on top of
      // capacity rather than consuming it, so it is reported beside the
      // percentage, never inside it.
      utilisation:
        r.availableMinutes > 0
          ? Math.round((r.standardMinutes / r.availableMinutes) * 100)
          : null,
    }))
    .filter(
      (r) =>
        r.availableMinutes > 0 ||
        r.standardMinutes + r.ot15Minutes + r.ot2Minutes > 0
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Schedule adherence (spec §6.8) ────────────────────────────────

export type AdherenceRow = {
  buildId: string;
  buNumber: string;
  customer: string;
  project: string | null;
  status: string;
  requestedDelivery: string | null;
  scheduledCompletion: string | null;
  daysLate: number | null;
  unscheduledMinutes: number;
};

export async function scheduleAdherence(): Promise<AdherenceRow[]> {
  const supabase = await createClient();

  const [{ data: builds }, { data: assignments }] = await Promise.all([
    supabase
      .from("builds")
      .select(
        `id, bu_number, requested_delivery_date,
         customers(name), projects(name), build_statuses!inner(name, code),
         operations(id, estimated_hours, assignments(planned_hours))`
      )
      .neq("build_statuses.code", "READY_DESPATCH")
      .order("bu_number"),
    supabase.from("assignments").select("date, operations(build_id)"),
  ]);

  const lastDateByBuild = new Map<string, string>();
  for (const a of assignments ?? []) {
    const buildId = a.operations?.build_id;
    if (!buildId) continue;
    const current = lastDateByBuild.get(buildId);
    if (!current || a.date > current) lastDateByBuild.set(buildId, a.date);
  }

  return (builds ?? [])
    .map((b) => {
      const scheduledCompletion = lastDateByBuild.get(b.id) ?? null;
      const requestedDelivery = b.requested_delivery_date;

      const daysLate =
        scheduledCompletion && requestedDelivery && scheduledCompletion > requestedDelivery
          ? Math.round(
              (new Date(`${scheduledCompletion}T00:00:00Z`).getTime() -
                new Date(`${requestedDelivery}T00:00:00Z`).getTime()) /
                86_400_000
            )
          : null;

      // Work still unassigned means the real finish is later than the
      // schedule currently shows — reported so a build is not called
      // on-time purely because nobody has scheduled the rest of it.
      const unscheduledMinutes = b.operations.reduce((sum, op) => {
        const estimated = Math.round(Number(op.estimated_hours) * 60);
        const assigned = op.assignments.reduce(
          (s, a) => s + Math.round(Number(a.planned_hours) * 60),
          0
        );
        return sum + Math.max(0, estimated - assigned);
      }, 0);

      return {
        buildId: b.id,
        buNumber: b.bu_number,
        customer: b.customers?.name ?? "—",
        project: b.projects?.name ?? null,
        status: b.build_statuses?.name ?? "—",
        requestedDelivery,
        scheduledCompletion,
        daysLate,
        unscheduledMinutes,
      };
    })
    .sort((a, b) => {
      // Late first, worst first; then the rest by delivery date.
      if (a.daysLate !== null && b.daysLate !== null) return b.daysLate - a.daysLate;
      if (a.daysLate !== null) return -1;
      if (b.daysLate !== null) return 1;
      return (a.requestedDelivery ?? "9999").localeCompare(
        b.requestedDelivery ?? "9999"
      );
    });
}

// ── Customer and project analysis (spec §6.8) ─────────────────────

export type RollupRow = {
  key: string;
  customer: string;
  project: string | null;
  builds: number;
  estimatedMinutes: number;
  actualMinutes: number;
  otMinutes: number;
  lateBuilds: number;
};

export async function customerRollup(
  groupByProject: boolean
): Promise<RollupRow[]> {
  const [progress, adherence] = await Promise.all([
    buildProgress(),
    scheduleAdherence(),
  ]);

  const supabase = await createClient();
  const [{ data: builds }, { data: segments }, { data: operations }] =
    await Promise.all([
      supabase
        .from("builds")
        .select("id, customers(name), projects(name)"),
      supabase
        .from("active_time_entry_segments")
        .select("operation_id, ot_class, minutes")
        .neq("ot_class", "none"),
      supabase.from("operations").select("id, build_id"),
    ]);

  const buildByOperation = new Map(
    (operations ?? []).map((o) => [o.id, o.build_id])
  );
  const otByBuild = new Map<string, number>();
  for (const s of segments ?? []) {
    const buildId = buildByOperation.get(s.operation_id ?? "");
    if (!buildId || !s.minutes) continue;
    otByBuild.set(buildId, (otByBuild.get(buildId) ?? 0) + s.minutes);
  }

  const meta = new Map(
    (builds ?? []).map((b) => [
      b.id,
      { customer: b.customers?.name ?? "—", project: b.projects?.name ?? null },
    ])
  );
  const lateByBuild = new Map(
    adherence.map((a) => [a.buildId, a.daysLate !== null])
  );

  const rows = new Map<string, RollupRow>();
  for (const p of progress) {
    const m = meta.get(p.buildId);
    if (!m) continue;
    const key = groupByProject ? `${m.customer}||${m.project ?? ""}` : m.customer;

    const row =
      rows.get(key) ??
      ({
        key,
        customer: m.customer,
        project: groupByProject ? m.project : null,
        builds: 0,
        estimatedMinutes: 0,
        actualMinutes: 0,
        otMinutes: 0,
        lateBuilds: 0,
      } as RollupRow);

    row.builds += 1;
    row.estimatedMinutes += p.estimatedMinutes;
    row.actualMinutes += p.actualMinutes;
    row.otMinutes += otByBuild.get(p.buildId) ?? 0;
    if (lateByBuild.get(p.buildId)) row.lateBuilds += 1;
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.customer.localeCompare(b.customer) ||
      (a.project ?? "").localeCompare(b.project ?? "")
  );
}
