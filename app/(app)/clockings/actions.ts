"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Admin clocking corrections (spec §6.6). Admin-only by RLS: commercial,
// workshop, and viewer have no update path on time_entries.
//
// Almost all the integrity lives in the database and is deliberately NOT
// repeated here:
//   · original_values / adjusted_by / adjusted_at — audit trigger
//   · voided_by / voided_at, and admin-only voiding — void guard trigger
//   · ot_class — derived from the timestamps on every write
//   · hard deletes — impossible, no delete policy exists for any role
// These actions supply intent; the database supplies the guarantees.

function back(params: string) {
  return `/clockings${params}`;
}

// Datetime-local inputs post "YYYY-MM-DDTHH:mm" with no zone. The workshop
// works in UK local time, so interpret them as Europe/London rather than as
// the server's zone (which in production is UTC).
function localToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  // Probe the offset that applies at that instant, then apply it.
  const asUtc = new Date(`${value}:00Z`);
  const londonLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "longOffset",
  })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = londonLabel?.replace("GMT", "") || "+00:00";
  return new Date(`${value}:00${offset === "" ? "+00:00" : offset}`).toISOString();
}

export async function createTimeEntry(formData: FormData) {
  const workerId = String(formData.get("worker_id") ?? "");
  const operationId = String(formData.get("operation_id") ?? "");
  const startedAt = localToIso(String(formData.get("started_at") ?? ""));
  const endedRaw = String(formData.get("ended_at") ?? "");
  const endedAt = endedRaw ? localToIso(endedRaw) : null;

  if (!workerId || !operationId) redirect(back("?error=missing"));
  if (!startedAt) redirect(back("?error=start"));
  if (endedRaw && !endedAt) redirect(back("?error=end"));
  if (endedAt && endedAt <= startedAt) redirect(back("?error=order"));

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    worker_id: workerId,
    operation_id: operationId,
    started_at: startedAt,
    ended_at: endedAt,
  });

  if (error) redirect(back("?error=save"));

  revalidatePath("/clockings");
  revalidatePath("/production");
  redirect(back("?saved=added"));
}

export async function updateTimeEntry(id: string, formData: FormData) {
  const workerId = String(formData.get("worker_id") ?? "");
  const operationId = String(formData.get("operation_id") ?? "");
  const startedAt = localToIso(String(formData.get("started_at") ?? ""));
  const endedRaw = String(formData.get("ended_at") ?? "");
  const endedAt = endedRaw ? localToIso(endedRaw) : null;

  if (!workerId || !operationId) redirect(back("?error=missing"));
  if (!startedAt) redirect(back("?error=start"));
  if (endedRaw && !endedAt) redirect(back("?error=end"));
  if (endedAt && endedAt <= startedAt) redirect(back("?error=order"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({
      worker_id: workerId,
      operation_id: operationId,
      started_at: startedAt,
      ended_at: endedAt,
    })
    .eq("id", id);

  if (error) redirect(back("?error=save"));

  revalidatePath("/clockings");
  revalidatePath("/production");
  redirect(back("?saved=corrected"));
}

// Soft delete (CLAUDE.md rule 6 / spec §6.6). The values stay; the entry
// leaves every total and screen except this one. The UI gates this behind an
// explicit confirmation.
export async function voidTimeEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ voided: true })
    .eq("id", id);

  if (error) redirect(back("?error=void"));

  revalidatePath("/clockings");
  revalidatePath("/production");
  redirect(back("?voided=1&show=voided"));
}

// An entry voided in error comes back from the audit view (spec §6.6).
export async function restoreTimeEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ voided: false })
    .eq("id", id);

  if (error) redirect(back("?error=void&show=voided"));

  revalidatePath("/clockings");
  revalidatePath("/production");
  redirect(back("?saved=restored&show=voided"));
}
