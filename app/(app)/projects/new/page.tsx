import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "../actions";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await getUserProfile();
  if (!auth || !["admin", "commercial"].includes(auth.profile.role)) {
    redirect("/projects");
  }

  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return (
    <main className="max-w-xl">
      <Link
        href="/projects"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Projects
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New project
      </h1>

      {!customers || customers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Projects belong to a customer, and there are no active customers
          yet —{" "}
          <Link
            href="/customers/new"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            create the customer first
          </Link>
          .
        </p>
      ) : (
        <form action={createProject} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="customer_id"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              id="customer_id"
              name="customer_id"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="" disabled>
                Select a customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Fixed once created — builds group under the project and carry
              the customer themselves.
            </p>
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Project name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {error === "customer" && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Choose a customer.
            </p>
          )}
          {error === "name" && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Project name is required.
            </p>
          )}
          {error === "save" && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              Could not save the project — try again.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
            >
              Create project
            </button>
            <Link
              href="/projects"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
