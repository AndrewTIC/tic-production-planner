import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createBuild } from "../actions";
import { CustomerProjectSelect } from "../customer-project-select";

const inputClasses =
  "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClasses =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const errorMessages: Record<string, string> = {
  bu_number: "BU number is required.",
  part: "Choose the part this build makes.",
  customer: "Every build belongs to a customer — choose one.",
  status: "Choose a status.",
  project_mismatch: "That project belongs to a different customer.",
  duplicate: "That BU number already exists — BU numbers are unique.",
  save: "Could not save the build — try again.",
};

export default async function NewBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await getUserProfile();
  if (!auth || !["admin", "commercial"].includes(auth.profile.role)) {
    redirect("/builds");
  }

  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: customers }, { data: projects }, { data: parts }, { data: statuses }] =
    await Promise.all([
      supabase.from("customers").select("id, name").eq("active", true).order("name"),
      supabase.from("projects").select("id, name, customer_id").order("name"),
      supabase.from("parts").select("id, part_number, description").order("part_number"),
      supabase.from("build_statuses").select("id, code, name").order("sequence"),
    ]);

  const missing: string[] = [];
  if (!customers || customers.length === 0) missing.push("an active customer");
  if (!parts || parts.length === 0) missing.push("a part");

  const defaultStatusId = statuses?.find((s) => s.code === "ORDER")?.id;

  return (
    <main className="max-w-2xl">
      <Link
        href="/builds"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Order Book
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New build
      </h1>

      {missing.length > 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          A build links a part to a customer’s order, and there isn’t{" "}
          {missing.join(" or ")} yet — create those first:{" "}
          <Link
            href="/customers"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            customers
          </Link>
          {" · "}
          <Link
            href="/parts"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            parts
          </Link>
        </p>
      ) : (
        <form action={createBuild} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bu_number" className={labelClasses}>
                BU number <span className="text-red-500">*</span>
              </label>
              <input
                id="bu_number"
                name="bu_number"
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. BU12345"
                className={`${inputClasses} font-mono`}
              />
            </div>

            <div>
              <label htmlFor="part_id" className={labelClasses}>
                Part <span className="text-red-500">*</span>
              </label>
              <select
                id="part_id"
                name="part_id"
                required
                defaultValue=""
                className={inputClasses}
              >
                <option value="" disabled>
                  Select a part…
                </option>
                {parts!.map((p) => (
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
              customers={customers!}
              projects={projects ?? []}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="status_id" className={labelClasses}>
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="status_id"
                name="status_id"
                required
                defaultValue={defaultStatusId}
                className={inputClasses}
              >
                {statuses!.map((s) => (
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
                defaultValue="Normal"
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
                className={`${inputClasses} font-mono`}
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                The single-line SO carrying the part number.
              </p>
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
                className={`${inputClasses} font-mono`}
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                The full build BOM — keeps the planner cross-referenced with
                OrderWise.
              </p>
            </div>
          </div>

          {error && errorMessages[error] && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {errorMessages[error]}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
            >
              Create build
            </button>
            <Link
              href="/builds"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Material lines are added on the build page after creation.
          </p>
        </form>
      )}
    </main>
  );
}
