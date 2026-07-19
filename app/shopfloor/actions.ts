"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shopfloor clocking actions (spec §6.6). The kiosk is signed in as one
// shared workshop-role user; the WORKER is whoever is selected on screen,
// recorded as worker_id — never auth.uid(). RLS lets workshop insert time
// entries and close open ones; ot_class, the In-Build status change, and
// the correction audit all happen in the database, not here.

function kioskPath(workerId: string) {
  return `/shopfloor?worker=${workerId}`;
}

// Closes any entry this worker has left open. Used both by Clock off and
// by Clock on — clocking onto new work ends the previous job (spec §6.6).
async function closeOpenEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workerId: string
): Promise<boolean> {
  const { data: open } = await supabase
    .from("active_time_entries")
    .select("id")
    .eq("worker_id", workerId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Views drop NOT NULL, so the generated types make every column nullable.
  if (!open?.id) return true;

  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", open.id);

  return !error;
}

export async function clockOn(workerId: string, operationId: string) {
  const supabase = await createClient();

  if (!(await closeOpenEntry(supabase, workerId))) {
    redirect(`${kioskPath(workerId)}&error=switch`);
  }

  const { error } = await supabase.from("time_entries").insert({
    worker_id: workerId,
    operation_id: operationId,
    started_at: new Date().toISOString(),
  });

  if (error) redirect(`${kioskPath(workerId)}&error=on`);

  revalidatePath("/shopfloor");
  revalidatePath("/production");
  redirect(kioskPath(workerId));
}

export async function clockOff(workerId: string) {
  const supabase = await createClient();

  if (!(await closeOpenEntry(supabase, workerId))) {
    redirect(`${kioskPath(workerId)}&error=off`);
  }

  revalidatePath("/shopfloor");
  revalidatePath("/production");
  redirect(`${kioskPath(workerId)}&done=1`);
}

// Blocked flags surface immediately on the scheduling board (spec §6.6).
// Workshop may only touch blocked/blocked_reason — a database trigger
// enforces that, so this action cannot overreach even if it tried.
export async function setBlocked(
  workerId: string,
  operationId: string,
  formData: FormData
) {
  const reason = String(formData.get("blocked_reason") ?? "").trim();
  if (!reason) redirect(`${kioskPath(workerId)}&error=reason`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("operations")
    .update({ blocked: true, blocked_reason: reason })
    .eq("id", operationId);

  if (error) redirect(`${kioskPath(workerId)}&error=blocked`);

  revalidatePath("/shopfloor");
  revalidatePath("/production");
  redirect(`${kioskPath(workerId)}&blocked=1`);
}

export async function clearBlocked(workerId: string, operationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("operations")
    .update({ blocked: false, blocked_reason: null })
    .eq("id", operationId);

  if (error) redirect(`${kioskPath(workerId)}&error=blocked`);

  revalidatePath("/shopfloor");
  revalidatePath("/production");
  redirect(kioskPath(workerId));
}
