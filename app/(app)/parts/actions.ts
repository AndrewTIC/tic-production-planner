"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS (see customers/actions.ts).

// Postgres unique_violation — parts.part_number is unique.
const UNIQUE_VIOLATION = "23505";

export async function createPart(formData: FormData) {
  const partNumber = String(formData.get("part_number") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!partNumber) redirect("/parts/new?error=part_number");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parts")
    .insert({ part_number: partNumber, description: description || null })
    .select("id")
    .single();

  if (error?.code === UNIQUE_VIOLATION) redirect("/parts/new?error=duplicate");
  if (error || !data) redirect("/parts/new?error=save");

  revalidatePath("/parts");
  redirect(`/parts/${data.id}`);
}

export async function updatePart(id: string, formData: FormData) {
  const partNumber = String(formData.get("part_number") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!partNumber) redirect(`/parts/${id}?error=part_number`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("parts")
    .update({ part_number: partNumber, description: description || null })
    .eq("id", id);

  if (error?.code === UNIQUE_VIOLATION) redirect(`/parts/${id}?error=duplicate`);
  if (error) redirect(`/parts/${id}?error=save`);

  revalidatePath("/parts");
  revalidatePath(`/parts/${id}`);
  redirect(`/parts/${id}?saved=1`);
}
