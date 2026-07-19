"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Scheduling actions (slice 2). Unlike the register actions these RETURN
// structured results instead of redirecting — the client scheduling layer
// calls them programmatically, shows the undo toast, and refreshes the
// board. Writes are admin/commercial only, enforced by RLS; a denied write
// comes back as { ok: false }.

export type AssignmentValues = {
  operation_id: string;
  worker_id: string;
  date: string;
  planned_hours: number;
  overtime: boolean;
};

export type AssignmentRow = AssignmentValues & { id: string };

type Result =
  | { ok: true; assignment: AssignmentRow }
  | { ok: false; message: string };

const COLUMNS = "id, operation_id, worker_id, date, planned_hours, overtime";

function invalid(values: Partial<AssignmentValues>): string | null {
  if (values.planned_hours !== undefined) {
    const h = values.planned_hours;
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      return "Hours must be a number between 0 and 24, like 7.5";
    }
  }
  if (values.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    return "Pick a date for the assignment";
  }
  return null;
}

type BatchResult =
  | { ok: true; assignments: AssignmentRow[] }
  | { ok: false; message: string };

// Multi-day scheduling: one row per day, inserted as a batch so the undo
// toast can remove the whole allocation in one go. The client expands the
// date range and decides per-day overtime (standard / weekend-OT / all-OT);
// this action just validates and inserts.
export async function createAssignments(input: {
  operation_id: string;
  worker_id: string;
  planned_hours: number;
  days: { date: string; overtime: boolean }[];
}): Promise<BatchResult> {
  const problem = invalid({ planned_hours: input.planned_hours });
  if (problem) return { ok: false, message: problem };
  if (input.days.length === 0) {
    return { ok: false, message: "No days to schedule — check the dates and overtime mode." };
  }
  if (input.days.length > 31) {
    return { ok: false, message: "That range is over a month — schedule it in smaller blocks." };
  }
  for (const d of input.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
      return { ok: false, message: "Pick valid dates for the assignment" };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert(
      input.days.map((d) => ({
        operation_id: input.operation_id,
        worker_id: input.worker_id,
        planned_hours: input.planned_hours,
        date: d.date,
        overtime: d.overtime,
      }))
    )
    .select(COLUMNS);

  if (error || !data || data.length === 0) {
    return { ok: false, message: "Could not save the assignment — try again." };
  }
  revalidatePath("/production");
  return {
    ok: true,
    assignments: data.map((a) => ({ ...a, planned_hours: Number(a.planned_hours) })),
  };
}

// Undo of a batch create.
export async function deleteAssignments(ids: string[]): Promise<BatchResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .delete()
    .in("id", ids)
    .select(COLUMNS);

  if (error || !data) {
    return { ok: false, message: "Could not remove the assignments — try again." };
  }
  revalidatePath("/production");
  return {
    ok: true,
    assignments: data.map((a) => ({ ...a, planned_hours: Number(a.planned_hours) })),
  };
}

export async function updateAssignment(
  id: string,
  values: Partial<AssignmentValues>
): Promise<Result> {
  const problem = invalid(values);
  if (problem) return { ok: false, message: problem };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update(values)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: "Could not save the change — try again." };
  }
  revalidatePath("/production");
  return { ok: true, assignment: { ...data, planned_hours: Number(data.planned_hours) } };
}

export async function deleteAssignment(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: "Could not remove the assignment — try again." };
  }
  revalidatePath("/production");
  return { ok: true, assignment: { ...data, planned_hours: Number(data.planned_hours) } };
}

// Undo of a delete: re-insert with the ORIGINAL id, so a later undo chain
// (or anything else holding the id) stays coherent.
export async function restoreAssignment(row: AssignmentRow): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert(row)
    .select(COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, message: "Could not restore the assignment." };
  }
  revalidatePath("/production");
  return { ok: true, assignment: { ...data, planned_hours: Number(data.planned_hours) } };
}
