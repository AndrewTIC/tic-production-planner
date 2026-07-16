"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS (see customers/actions.ts).

export async function createProject(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerId) redirect("/projects/new?error=customer");
  if (!name) redirect("/projects/new?error=name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ customer_id: customerId, name, notes: notes || null })
    .select("id")
    .single();

  if (error || !data) redirect("/projects/new?error=save");

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

// customer_id is deliberately not updatable: builds carry their own
// customer_id, so re-homing a project under a different customer would
// contradict the builds already grouped beneath it. Created against the
// wrong customer, no builds yet? Make a new project; this one can sit
// unused (projects with no builds cost nothing).
export async function updateProject(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) redirect(`/projects/${id}?error=name`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name, notes: notes || null })
    .eq("id", id);

  if (error) redirect(`/projects/${id}?error=save`);

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}?saved=1`);
}
