import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { updateCustomer } from "../actions";

export default async function CustomerPage({
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
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const updateWithId = updateCustomer.bind(null, customer.id);

  return (
    <main className="max-w-xl">
      <Link
        href="/customers"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {customer.name}
        </h1>
        {!customer.active && (
          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Inactive
          </span>
        )}
      </div>

      <form action={canWrite ? updateWithId : undefined} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name {canWrite && <span className="text-red-500">*</span>}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            disabled={!canWrite}
            defaultValue={customer.name}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Contact notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            disabled={!canWrite}
            defaultValue={customer.notes ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
        </div>

        <fieldset className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Badge colours
          </legend>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            How this customer appears on the production board:
          </p>
          <span
            className="mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium"
            style={{
              backgroundColor: customer.badge_bg,
              color: customer.badge_text,
            }}
          >
            {customer.name}
          </span>
          <div className="mt-3 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              Fill
              <input
                type="color"
                name="badge_bg"
                disabled={!canWrite}
                defaultValue={customer.badge_bg}
                className="h-9 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              Font
              <input
                type="color"
                name="badge_text"
                disabled={!canWrite}
                defaultValue={customer.badge_text}
                className="h-9 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
              />
            </label>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="active"
            disabled={!canWrite}
            defaultChecked={customer.active}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Active
          <span className="text-zinc-400 dark:text-zinc-500">
            — customers are deactivated, never deleted; their builds keep
            their history
          </span>
        </label>

        {error === "name" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Name is required.
          </p>
        )}
        {error === "save" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Could not save the changes — try again.
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
              href="/customers"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        )}
      </form>

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(customer.created_at)} · Last updated{" "}
        {formatDateTime(customer.updated_at)}
      </p>
    </main>
  );
}
