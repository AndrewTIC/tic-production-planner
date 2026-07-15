import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { updatePart } from "../actions";

export default async function PartPage({
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
  const { data: part } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .single();

  if (!part) notFound();

  const updateWithId = updatePart.bind(null, part.id);

  return (
    <main className="max-w-xl">
      <Link
        href="/parts"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Parts
      </Link>
      <h1 className="mt-2 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {part.part_number}
      </h1>

      <form action={canWrite ? updateWithId : undefined} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="part_number"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Part number {canWrite && <span className="text-red-500">*</span>}
          </label>
          <input
            id="part_number"
            name="part_number"
            type="text"
            required
            autoComplete="off"
            disabled={!canWrite}
            defaultValue={part.part_number}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
          {canWrite && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Every build of this part links here — only correct the number,
              don’t reuse the record for a different part.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            disabled={!canWrite}
            defaultValue={part.description ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400"
          />
        </div>

        {error === "part_number" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Part number is required.
          </p>
        )}
        {error === "duplicate" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Another part already has that number.
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
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save changes
            </button>
            <Link
              href="/parts"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        )}
      </form>

      <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
        Created {formatDateTime(part.created_at)} · Last updated{" "}
        {formatDateTime(part.updated_at)}
      </p>
    </main>
  );
}
