"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS (see customers/actions.ts).

export async function createWorker(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "") || null;
  const phaseIds = formData.getAll("phases").map(String);

  if (!name) redirect("/workers/new?error=name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workers")
    .insert({ name, user_id: userId })
    .select("id")
    .single();

  if (error || !data) redirect("/workers/new?error=save");

  if (phaseIds.length > 0) {
    const { error: phaseError } = await supabase
      .from("worker_phases")
      .insert(phaseIds.map((phaseId) => ({ worker_id: data.id, phase_id: phaseId })));
    // Worker exists either way; competencies are editable on their page.
    if (phaseError) redirect(`/workers/${data.id}?error=phases`);
  }

  revalidatePath("/workers");
  redirect(`/workers/${data.id}`);
}

export async function updateWorker(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "") || null;
  const active = formData.get("active") === "on";
  const phaseIds = formData.getAll("phases").map(String);

  if (!name) redirect(`/workers/${id}?error=name`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("workers")
    .update({ name, user_id: userId, active })
    .eq("id", id);

  if (error) redirect(`/workers/${id}?error=save`);

  // Replace competencies wholesale — a tiny set (max 3 rows per worker).
  const { error: deleteError } = await supabase
    .from("worker_phases")
    .delete()
    .eq("worker_id", id);
  if (deleteError) redirect(`/workers/${id}?error=phases`);

  if (phaseIds.length > 0) {
    const { error: insertError } = await supabase
      .from("worker_phases")
      .insert(phaseIds.map((phaseId) => ({ worker_id: id, phase_id: phaseId })));
    if (insertError) redirect(`/workers/${id}?error=phases`);
  }

  revalidatePath("/workers");
  revalidatePath(`/workers/${id}`);
  redirect(`/workers/${id}?saved=1`);
}
