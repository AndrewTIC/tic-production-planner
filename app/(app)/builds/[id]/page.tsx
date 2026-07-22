import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { materialBadge } from "@/lib/materials";
import {
  addMaterialItem,
  addNote,
  addOperation,
  deleteDocument,
  deleteMaterialItem,
  deleteOperation,
  downloadDocument,
  setMaterialItemBookedIn,
  setNoteHidden,
  updateBuild,
  updateOperation,
  uploadDocument,
} from "../actions";
import { CustomerProjectSelect } from "../customer-project-select";
import { MaterialBadgeChip } from "../material-badge";

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400";
const labelClasses =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const errorMessages: Record<string, string> = {
  bu_number: "BU number is required.",
  project_mismatch: "That project belongs to a different customer.",
  duplicate: "Another build already has that BU number.",
  save: "Could not save the build — try again.",
  component: "Component part number is required for a material line.",
  material_save: "Could not save the material line — try again.",
  op_phase: "Choose a phase for the operation.",
  op_hours: "Estimated hours must be a number between 0 and 9999.",
  op_save: "Could not save the operation — try again.",
  op_delete:
    "Could not delete the operation — it may already have assignments or booked time.",
  note_empty: "Write something before adding the note.",
  note_save: "Could not add the note — try again.",
  note_hide: "Could not change the note — try again.",
  doc_missing: "Choose a file to upload.",
  doc_size: "That file is over the 50 MB limit.",
  doc_upload: "Could not upload the file — try again.",
  doc_save: "Uploaded the file but could not record it — try again.",
  doc_download: "Could not open that document — try again.",
  doc_delete: "Could not remove that document — try again.",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const OPERATION_STATUSES = ["Pending", "In Progress", "Complete"];
const PHASE_ORDER: Record<string, number> = { MECH: 1, ELEC: 2, INSP: 3 };

export default async function BuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, { error, saved }] = await Promise.all([params, searchParams]);

  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const [
    { data: build },
    { data: customers },
    { data: projects },
    { data: parts },
    { data: statuses },
    { data: phases },
  ] = await Promise.all([
    supabase
      .from("builds")
      .select("*, material_items(*), operations(*, phases(code, name))")
      .eq("id", id)
      .single(),
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("projects").select("id, name, customer_id").order("name"),
    supabase.from("parts").select("id, part_number, description").order("part_number"),
    supabase.from("build_statuses").select("id, code, name").order("sequence"),
    supabase.from("phases").select("id, code, name").order("code"),
  ]);

  // Notes and documents (spec §6.7). Notes are the append-only activity log;
  // hidden ones are visible to Admin only, never deleted.
  const [{ data: notes }, { data: documents }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("notes")
        .select("id, body, hidden, author_id, created_at")
        .eq("build_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, filename, file_type, size_bytes, note_id, uploaded_by, created_at")
        .eq("build_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);

  const who = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const isAdmin = auth?.profile.role === "admin";
  const canNote =
    auth !== null &&
    ["admin", "commercial", "workshop"].includes(auth.profile.role);
  const visibleNotes = (notes ?? []).filter((n) => isAdmin || !n.hidden);

  // Attachments belong under the note that carries them; the Documents
  // section lists the build's standalone paperwork.
  const standaloneDocs = (documents ?? []).filter((d) => !d.note_id);
  const docsByNote = new Map<string, typeof documents>();
  for (const d of documents ?? []) {
    if (!d.note_id) continue;
    const list = docsByNote.get(d.note_id);
    if (list) list.push(d);
    else docsByNote.set(d.note_id, [d]);
  }

  if (!build) notFound();

  const updateWithId = updateBuild.bind(null, build.id);
  const addMaterialWithId = addMaterialItem.bind(null, build.id);
  const addOperationWithId = addOperation.bind(null, build.id);

  const operations = (build.operations ?? []).sort(
    (a, b) =>
      (PHASE_ORDER[a.phases?.code ?? ""] ?? 9) -
        (PHASE_ORDER[b.phases?.code ?? ""] ?? 9) ||
      a.created_at.localeCompare(b.created_at)
  );
  const totalEstimated = operations.reduce(
    (sum, op) => sum + Number(op.estimated_hours),
    0
  );

  const materials = (build.material_items ?? []).sort((a, b) =>
    (a.expected_delivery_date ?? "9999").localeCompare(
      b.expected_delivery_date ?? "9999"
    )
  );
  const badge = materialBadge(build.materials_complete, materials);

  return (
    <main className="max-w-3xl">
      <Link
        href="/builds"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Order Book
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {build.bu_number}
        </h1>
        <MaterialBadgeChip badge={badge} />
      </div>

      <form action={canWrite ? updateWithId : undefined} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bu_number" className={labelClasses}>
              BU number {canWrite && <span className="text-red-500">*</span>}
            </label>
            <input
              id="bu_number"
              name="bu_number"
              type="text"
              required
              autoComplete="off"
              disabled={!canWrite}
              defaultValue={build.bu_number}
              className={`${inputClasses} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="part_id" className={labelClasses}>
              Part {canWrite && <span className="text-red-500">*</span>}
            </label>
            <select
              id="part_id"
              name="part_id"
              required
              disabled={!canWrite}
              defaultValue={build.part_id}
              className={inputClasses}
            >
              {(parts ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.part_number}
                  {p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomerProjectSelect
            customers={customers ?? []}
            projects={projects ?? []}
            defaultCustomerId={build.customer_id}
            defaultProjectId={build.project_id ?? ""}
            disabled={!canWrite}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="status_id" className={labelClasses}>
              Status {canWrite && <span className="text-red-500">*</span>}
            </label>
            <select
              id="status_id"
              name="status_id"
              required
              disabled={!canWrite}
              defaultValue={build.status_id}
              className={inputClasses}
            >
              {(statuses ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className={labelClasses}>
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              disabled={!canWrite}
              defaultValue={build.priority}
              className={inputClasses}
            >
              <option>Low</option>
              <option>Normal</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>

          <div>
            <label htmlFor="order_number" className={labelClasses}>
              Order number
            </label>
            <input
              id="order_number"
              name="order_number"
              type="text"
              autoComplete="off"
              disabled={!canWrite}
              defaultValue={build.order_number ?? ""}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="order_received_date" className={labelClasses}>
              Date order received
            </label>
            <input
              id="order_received_date"
              name="order_received_date"
              type="date"
              disabled={!canWrite}
              defaultValue={build.order_received_date ?? ""}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="requested_delivery_date" className={labelClasses}>
              Requested delivery date
            </label>
            <input
              id="requested_delivery_date"
              name="requested_delivery_date"
              type="date"
              disabled={!canWrite}
              defaultValue={build.requested_delivery_date ?? ""}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ow_sales_order_ref" className={labelClasses}>
              OrderWise SO ref
            </label>
            <input
              id="ow_sales_order_ref"
              name="ow_sales_order_ref"
              type="text"
              autoComplete="off"
              disabled={!canWrite}
              defaultValue={build.ow_sales_order_ref ?? ""}
              className={`${inputClasses} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="ow_esd_sales_order_ref" className={labelClasses}>
              Internal ESD OrderWise SO ref
            </label>
            <input
              id="ow_esd_sales_order_ref"
              name="ow_esd_sales_order_ref"
              type="text"
              autoComplete="off"
              disabled={!canWrite}
              defaultValue={build.ow_esd_sales_order_ref ?? ""}
              className={`${inputClasses} font-mono`}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="materials_complete"
            disabled={!canWrite}
            defaultChecked={build.materials_complete}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          <span>
            Materials complete
            <span className="block text-xs text-zinc-400 dark:text-zinc-500">
              Set manually when all materials are booked in — informational
              only, never blocks scheduling.
            </span>
          </span>
        </label>

        {error && errorMessages[error] && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errorMessages[error]}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            Saved.
          </p>
        )}

        {canWrite && (
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
            >
              Save changes
            </button>
            <Link
              href="/builds"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        )}
      </form>

      {/* ── Phase operations (spec §6.2) ───────────────────────── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Phase operations
          </h2>
          {operations.length > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalEstimated.toFixed(2).replace(/\.?0+$/, "")} h estimated
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The units the scheduling board assigns to workers. Mechanical and
          Electrical routinely run concurrently — no ordering is imposed.
        </p>

        {operations.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No operations yet.
            {canWrite && " Add one per phase with estimated hours."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[44rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Phase
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Est. hours
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Status
                  </th>
                  {canWrite && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {operations.map((op) => {
                  const rowFormId = `op-${op.id}`;
                  return (
                    <tr key={op.id}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {op.phases?.code ?? "—"}
                        </span>
                        {op.blocked && (
                          <span
                            className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300"
                            title={op.blocked_reason ?? undefined}
                          >
                            Blocked
                          </span>
                        )}
                      </td>
                      {canWrite ? (
                        <>
                          <td className="px-4 py-2">
                            {/* Carrier form — row inputs reference it via the
                                form attribute (forms can't wrap table rows). */}
                            <form
                              id={rowFormId}
                              action={updateOperation.bind(null, build.id, op.id)}
                            />
                            <input
                              name="description"
                              type="text"
                              form={rowFormId}
                              defaultValue={op.description ?? ""}
                              className="w-full min-w-[12rem] rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              name="estimated_hours"
                              type="number"
                              step="0.25"
                              min="0"
                              max="9999"
                              required
                              form={rowFormId}
                              defaultValue={Number(op.estimated_hours)}
                              className="w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              name="status"
                              form={rowFormId}
                              defaultValue={op.status}
                              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              {OPERATION_STATUSES.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="submit"
                                form={rowFormId}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                Update
                              </button>
                              <form action={deleteOperation.bind(null, build.id, op.id)}>
                                <button
                                  type="submit"
                                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                            {op.description ?? ""}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                            {Number(op.estimated_hours)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                            {op.status}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && (
          <form
            action={addOperationWithId}
            className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_1fr_auto_auto]"
          >
            <div>
              <label htmlFor="phase_id" className={labelClasses}>
                Phase <span className="text-red-500">*</span>
              </label>
              <select
                id="phase_id"
                name="phase_id"
                required
                defaultValue=""
                className={inputClasses}
              >
                <option value="" disabled>
                  Select…
                </option>
                {(phases ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="op_description" className={labelClasses}>
                Description
              </label>
              <input
                id="op_description"
                name="description"
                type="text"
                autoComplete="off"
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="op_estimated_hours" className={labelClasses}>
                Est. hours <span className="text-red-500">*</span>
              </label>
              <input
                id="op_estimated_hours"
                name="estimated_hours"
                type="number"
                step="0.25"
                min="0"
                max="9999"
                required
                className={inputClasses}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Add operation
            </button>
          </form>
        )}
      </section>

      {/* ── Material lines (spec §6.3) ─────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Outstanding materials
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Component lines worth communicating — free text, bought-in parts
          stay out of the ESD parts register. Builds routinely start with
          items outstanding.
        </p>

        {materials.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No material lines recorded.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[40rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Component
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Expected
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                    Booked in
                  </th>
                  {canWrite && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">
                      {m.component_part_number}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {m.description ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(m.expected_delivery_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {m.booked_in ? (
                        <span className="text-green-700 dark:text-green-400">
                          ✓ {formatDate(m.booked_in_date)}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          Outstanding
                        </span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <form
                            action={setMaterialItemBookedIn.bind(
                              null,
                              build.id,
                              m.id,
                              !m.booked_in
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              {m.booked_in ? "Mark outstanding" : "Book in"}
                            </button>
                          </form>
                          <form action={deleteMaterialItem.bind(null, build.id, m.id)}>
                            <button
                              type="submit"
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && (
          <form
            action={addMaterialWithId}
            className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          >
            <div>
              <label htmlFor="component_part_number" className={labelClasses}>
                Component part no. <span className="text-red-500">*</span>
              </label>
              <input
                id="component_part_number"
                name="component_part_number"
                type="text"
                required
                autoComplete="off"
                className={`${inputClasses} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="description" className={labelClasses}>
                Description
              </label>
              <input
                id="description"
                name="description"
                type="text"
                autoComplete="off"
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="expected_delivery_date" className={labelClasses}>
                Expected
              </label>
              <input
                id="expected_delivery_date"
                name="expected_delivery_date"
                type="date"
                className={inputClasses}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Add line
            </button>
          </form>
        )}
      </section>

      {/* ── Documents (spec §6.7) ──────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Documents
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Drawings, red-pen markups, photos, and paperwork for this build.
          Downloads open through a short-lived link rather than a public URL.
        </p>

        {standaloneDocs.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No documents yet.
            {(documents ?? []).length > 0 &&
              " Photos attached to notes appear with their note below."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {standaloneDocs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {d.filename}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatBytes(d.size_bytes)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {who.get(d.uploaded_by) ?? "—"} ·{" "}
                  {formatDateTime(d.created_at)}
                </span>
                <span className="ml-auto flex gap-2">
                  <form action={downloadDocument.bind(null, build.id, d.id)}>
                    <button
                      type="submit"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Download
                    </button>
                  </form>
                  {canWrite && (
                    <form action={deleteDocument.bind(null, build.id, d.id)}>
                      <button
                        type="submit"
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <form
            action={uploadDocument.bind(null, build.id)}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label htmlFor="file" className={labelClasses}>
                Add a document
              </label>
              <input
                id="file"
                name="file"
                type="file"
                required
                className="mt-1 block text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-300"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Upload
            </button>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Up to 50 MB.
            </span>
          </form>
        )}
      </section>

      {/* ── Notes (spec §6.7) — append-only activity log ───────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Notes
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The build’s activity log. Notes cannot be edited or deleted once
          added — an Admin can hide one, and it stays on the record.
        </p>

        {canNote && (
          <form action={addNote.bind(null, build.id)} className="mt-4">
            <label htmlFor="body" className="sr-only">
              Note
            </label>
            <textarea
              id="body"
              name="body"
              rows={3}
              required
              placeholder="What happened, what changed, what to watch for…"
              className={inputClasses}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
              >
                Add note
              </button>
              <label htmlFor="attachment" className="sr-only">
                Attach a photo or file
              </label>
              <input
                id="attachment"
                name="attachment"
                type="file"
                className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-300"
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Optional — attach a red-pen photo or file.
              </span>
            </div>
          </form>
        )}

        {visibleNotes.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nothing logged yet.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {visibleNotes.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${
                  n.hidden
                    ? "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {who.get(n.author_id) ?? "Unknown"}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDateTime(n.created_at)}
                  </span>
                  {n.hidden && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      hidden — Admins only
                    </span>
                  )}
                  {isAdmin && (
                    <form
                      action={setNoteHidden.bind(
                        null,
                        build.id,
                        n.id,
                        !n.hidden
                      )}
                      className="ml-auto"
                    >
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {n.hidden ? "Unhide" : "Hide"}
                      </button>
                    </form>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {n.body}
                </p>
                {(docsByNote.get(n.id) ?? []).map((d) => (
                  <form
                    key={d.id}
                    action={downloadDocument.bind(null, build.id, d.id)}
                    className="mt-2"
                  >
                    <button
                      type="submit"
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span aria-hidden>📎</span>
                      {d.filename}
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {formatBytes(d.size_bytes)}
                      </span>
                    </button>
                  </form>
                ))}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(build.created_at)} · Last updated{" "}
        {formatDateTime(build.updated_at)}
      </p>
    </main>
  );
}
