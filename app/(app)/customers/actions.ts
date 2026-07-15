"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS, so these actions do
// not re-check the role; a denied write surfaces as a save error. The UI
// simply hides the controls from read-only roles.

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) redirect("/customers/new?error=name");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ name, notes: notes || null })
    .select("id")
    .single();

  if (error || !data) redirect("/customers/new?error=save");

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  // Checkbox: present in the form data only when ticked.
  const active = formData.get("active") === "on";

  if (!name) redirect(`/customers/${id}?error=name`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ name, notes: notes || null, active })
    .eq("id", id);

  if (error) redirect(`/customers/${id}?error=save`);

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?saved=1`);
}
