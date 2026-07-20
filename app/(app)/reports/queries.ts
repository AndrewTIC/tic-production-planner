import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/schedule";

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
