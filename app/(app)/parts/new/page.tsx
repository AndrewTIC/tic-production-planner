import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createPart } from "../actions";

export default async function NewPartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await getUserProfile();
  if (!auth || !["admin", "commercial"].includes(auth.profile.role)) {
    redirect("/parts");
  }

  const { error } = await searchParams;

  return (
    <main className="max-w-xl">
      <Link
        href="/parts"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Parts
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New part
      </h1>

      <form action={createPart} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="part_number"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Part number <span className="text-red-500">*</span>
          </label>
          <input
            id="part_number"
            name="part_number"
            type="text"
            required
            autoComplete="off"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
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
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-lime-700 focus:outline-none focus:ring-1 focus:ring-lime-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {error === "part_number" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Part number is required.
          </p>
        )}
        {error === "duplicate" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            That part number already exists — open it from the parts list
            instead.
          </p>
        )}
        {error === "save" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Could not save the part — try again.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
          >
            Create part
          </button>
          <Link
            href="/parts"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
