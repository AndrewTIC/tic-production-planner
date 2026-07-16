"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Writes are admin/commercial only — enforced by RLS (see customers/actions.ts).

const UNIQUE_VIOLATION = "23505";

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

// <input type="date"> posts "" when empty; Postgres wants null.
function optionalDate(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

// The DB does not enforce that a build's project belongs to the build's
// customer (project_id is just an FK to projects), so validate here.
async function projectMatchesCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  customerId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("customer_id")
    .eq("id", projectId)
    .single();
  return data?.customer_id === customerId;
}

export async function createBuild(formData: FormData) {
  const buNumber = String(formData.get("bu_number") ?? "").trim();
  const partId = String(formData.get("part_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "") || null;
  const statusId = String(formData.get("status_id") ?? "");
  const priority = String(formData.get("priority") ?? "Normal");

  if (!buNumber) redirect("/builds/new?error=bu_number");
  if (!partId) redirect("/builds/new?error=part");
  if (!customerId) redirect("/builds/new?error=customer");
  if (!statusId) redirect("/builds/new?error=status");

  const supabase = await createClient();

  if (projectId && !(await projectMatchesCustomer(supabase, projectId, customerId))) {
    redirect("/builds/new?error=project_mismatch");
  }

  const { data, error } = await supabase
    .from("builds")
    .insert({
      bu_number: buNumber,
      part_id: partId,
      customer_id: customerId,
      project_id: projectId,
      status_id: statusId,
      priority,
      order_number: optionalText(formData, "order_number"),
      order_received_date: optionalDate(formData, "order_received_date"),
      requested_delivery_date: optionalDate(formData, "requested_delivery_date"),
      ow_sales_order_ref: optionalText(formData, "ow_sales_order_ref"),
      ow_esd_sales_order_ref: optionalText(formData, "ow_esd_sales_order_ref"),
    })
    .select("id")
    .single();

  if (error?.code === UNIQUE_VIOLATION) redirect("/builds/new?error=duplicate");
  if (error || !data) redirect("/builds/new?error=save");

  revalidatePath("/builds");
  redirect(`/builds/${data.id}`);
}

export async function updateBuild(id: string, formData: FormData) {
  const buNumber = String(formData.get("bu_number") ?? "").trim();
  const partId = String(formData.get("part_id") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "") || null;
  const statusId = String(formData.get("status_id") ?? "");
  const priority = String(formData.get("priority") ?? "Normal");
  // materials_complete is a manual Commercial flag (CLAUDE.md rule 7).
  const materialsComplete = formData.get("materials_complete") === "on";

  if (!buNumber) redirect(`/builds/${id}?error=bu_number`);
  if (!partId || !customerId || !statusId) redirect(`/builds/${id}?error=save`);

  const supabase = await createClient();

  if (projectId && !(await projectMatchesCustomer(supabase, projectId, customerId))) {
    redirect(`/builds/${id}?error=project_mismatch`);
  }

  const { error } = await supabase
    .from("builds")
    .update({
      bu_number: buNumber,
      part_id: partId,
      customer_id: customerId,
      project_id: projectId,
      status_id: statusId,
      priority,
      materials_complete: materialsComplete,
      order_number: optionalText(formData, "order_number"),
      order_received_date: optionalDate(formData, "order_received_date"),
      requested_delivery_date: optionalDate(formData, "requested_delivery_date"),
      ow_sales_order_ref: optionalText(formData, "ow_sales_order_ref"),
      ow_esd_sales_order_ref: optionalText(formData, "ow_esd_sales_order_ref"),
    })
    .eq("id", id);

  if (error?.code === UNIQUE_VIOLATION) redirect(`/builds/${id}?error=duplicate`);
  if (error) redirect(`/builds/${id}?error=save`);

  revalidatePath("/builds");
  revalidatePath(`/builds/${id}`);
  redirect(`/builds/${id}?saved=1`);
}

// ── Phase operations (spec §6.2) ──────────────────────────────────
// The units the scheduling board will assign. Mechanical and Electrical
// run concurrently as a matter of course — no ordering is imposed here
// (an optional depends_on exists in the schema for the rare genuine case;
// UI for it comes with the board).

const OPERATION_STATUSES = ["Pending", "In Progress", "Complete"];

function parseHours(formData: FormData, key: string): number | null {
  const value = Number(formData.get(key));
  // numeric(6,2): sane planning range, quarter-hour steps enforced by the input.
  if (!Number.isFinite(value) || value < 0 || value > 9999) return null;
  return value;
}

export async function addOperation(buildId: string, formData: FormData) {
  const phaseId = String(formData.get("phase_id") ?? "");
  const description = optionalText(formData, "description");
  const estimatedHours = parseHours(formData, "estimated_hours");

  if (!phaseId) redirect(`/builds/${buildId}?error=op_phase`);
  if (estimatedHours === null) redirect(`/builds/${buildId}?error=op_hours`);

  const supabase = await createClient();
  const { error } = await supabase.from("operations").insert({
    build_id: buildId,
    phase_id: phaseId,
    description,
    estimated_hours: estimatedHours,
  });

  if (error) redirect(`/builds/${buildId}?error=op_save`);

  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/builds");
  redirect(`/builds/${buildId}`);
}

export async function updateOperation(
  buildId: string,
  operationId: string,
  formData: FormData
) {
  const description = optionalText(formData, "description");
  const estimatedHours = parseHours(formData, "estimated_hours");
  const status = String(formData.get("status") ?? "Pending");

  if (estimatedHours === null) redirect(`/builds/${buildId}?error=op_hours`);
  if (!OPERATION_STATUSES.includes(status)) redirect(`/builds/${buildId}?error=op_save`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("operations")
    .update({ description, estimated_hours: estimatedHours, status })
    .eq("id", operationId);

  if (error) redirect(`/builds/${buildId}?error=op_save`);

  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/builds");
  redirect(`/builds/${buildId}`);
}

// Fine while operations are planning data; once assignments or time
// entries reference one, the FK refuses and the error message says so.
export async function deleteOperation(buildId: string, operationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("operations")
    .delete()
    .eq("id", operationId);

  if (error) redirect(`/builds/${buildId}?error=op_delete`);

  revalidatePath(`/builds/${buildId}`);
  revalidatePath("/builds");
  redirect(`/builds/${buildId}`);
}

// ── Material lines (spec §6.3) ────────────────────────────────────
// Free-text component part numbers: bought-in components stay out of the
// ESD parts register. Lines are a chase list, not an audit record, so a
// mistyped line may simply be deleted.

export async function addMaterialItem(buildId: string, formData: FormData) {
  const componentPartNumber = String(
    formData.get("component_part_number") ?? ""
  ).trim();

  if (!componentPartNumber) redirect(`/builds/${buildId}?error=component`);

  const supabase = await createClient();
  const { error } = await supabase.from("material_items").insert({
    build_id: buildId,
    component_part_number: componentPartNumber,
    description: optionalText(formData, "description"),
    expected_delivery_date: optionalDate(formData, "expected_delivery_date"),
  });

  if (error) redirect(`/builds/${buildId}?error=material_save`);

  revalidatePath(`/builds/${buildId}`);
  redirect(`/builds/${buildId}`);
}

export async function setMaterialItemBookedIn(
  buildId: string,
  itemId: string,
  bookedIn: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("material_items")
    .update({
      booked_in: bookedIn,
      // Date recorded when ticked, cleared when unticked.
      booked_in_date: bookedIn ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", itemId);

  if (error) redirect(`/builds/${buildId}?error=material_save`);

  revalidatePath(`/builds/${buildId}`);
  redirect(`/builds/${buildId}`);
}

export async function deleteMaterialItem(buildId: string, itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("material_items")
    .delete()
    .eq("id", itemId);

  if (error) redirect(`/builds/${buildId}?error=material_save`);

  revalidatePath(`/builds/${buildId}`);
  redirect(`/builds/${buildId}`);
}
