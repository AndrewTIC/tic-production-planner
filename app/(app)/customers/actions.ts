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

  // Badge colours: the customer's identity chip on the production board.
  // <input type="color"> always posts #rrggbb; validate anyway, since the
  // DB check constraint would reject anything else.
  const hex = /^#[0-9a-fA-F]{6}$/;
  const badgeBg = String(formData.get("badge_bg") ?? "#B0CB1F");
  const badgeText = String(formData.get("badge_text") ?? "#24292E");
  if (!hex.test(badgeBg) || !hex.test(badgeText)) {
    redirect(`/customers/${id}?error=save`);
  }

  if (!name) redirect(`/customers/${id}?error=name`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name,
      notes: notes || null,
      active,
      badge_bg: badgeBg,
      badge_text: badgeText,
    })
    .eq("id", id);

  if (error) redirect(`/customers/${id}?error=save`);

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?saved=1`);
}
