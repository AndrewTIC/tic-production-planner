import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { materialBadge } from "@/lib/materials";
import {
  addMaterialItem,
  deleteMaterialItem,
  setMaterialItemBookedIn,
  updateBuild,
} from "../actions";
import { CustomerProjectSelect } from "../customer-project-select";
import { MaterialBadgeChip } from "../material-badge";

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400";
const labelClasses =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const errorMessages: Record<string, string> = {
  bu_number: "BU number is required.",
  project_mismatch: "That project belongs to a different customer.",
  duplicate: "Another build already has that BU number.",
  save: "Could not save the build — try again.",
  component: "Component part number is required for a material line.",
  material_save: "Could not save the material line — try again.",
};

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
  const [{ data: build }, { data: customers }, { data: projects }, { data: parts }, { data: statuses }] =
    await Promise.all([
      supabase
        .from("builds")
        .select("*, material_items(*)")
        .eq("id", id)
        .single(),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("projects").select("id, name, customer_id").order("name"),
      supabase.from("parts").select("id, part_number, description").order("part_number"),
      supabase.from("build_statuses").select("id, code, name").order("sequence"),
    ]);

  if (!build) notFound();

  const updateWithId = updateBuild.bind(null, build.id);
  const addMaterialWithId = addMaterialItem.bind(null, build.id);

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
        ← Builds
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
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(build.created_at)} · Last updated{" "}
        {formatDateTime(build.updated_at)}
      </p>
    </main>
  );
}
