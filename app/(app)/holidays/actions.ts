"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS (see customers/actions.ts).

export async function addHoliday(formData: FormData) {
  // "" = company-wide closure (worker_id null).
  const workerId = String(formData.get("worker_id") ?? "") || null;
  const dateFrom = String(formData.get("date_from") ?? "");
  // Single-day leave: allow leaving "to" empty.
  const dateTo = String(formData.get("date_to") ?? "") || dateFrom;
  const partOfDay = String(formData.get("part_of_day") ?? "full");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!["full", "am", "pm"].includes(partOfDay)) redirect("/holidays?error=save");
  if (!dateFrom) redirect("/holidays?error=dates");
  if (dateTo < dateFrom) redirect("/holidays?error=order");
  // Half days are single-date rows (DB-enforced); a half-day "range" is
  // recorded as separate rows, e.g. Thu PM + Fri–Mon full + Tue AM.
  if (partOfDay !== "full" && dateTo !== dateFrom) {
    redirect("/holidays?error=half_range");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({
    worker_id: workerId,
    date_from: dateFrom,
    date_to: dateTo,
    part_of_day: partOfDay,
    note,
  });

  if (error) redirect("/holidays?error=save");

  revalidatePath("/holidays");
  redirect("/holidays");
}

// Holidays are planning data, not an audit record — deletable.
export async function deleteHoliday(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("id", id);

  if (error) redirect("/holidays?error=save");

  revalidatePath("/holidays");
  redirect("/holidays");
}
