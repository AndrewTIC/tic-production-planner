import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createWorker } from "../actions";

export default async function NewWorkerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const auth = await getUserProfile();
  if (!auth || !["admin", "commercial"].includes(auth.profile.role)) {
    redirect("/workers");
  }

  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: phases }, { data: profiles }, { data: linkedWorkers }] =
    await Promise.all([
      supabase.from("phases").select("id, code, name").order("code"),
      supabase.from("profiles").select("id, display_name").order("display_name"),
      supabase.from("workers").select("user_id").not("user_id", "is", null),
    ]);

  const alreadyLinked = new Set((linkedWorkers ?? []).map((w) => w.user_id));
  const linkableProfiles = (profiles ?? []).filter((p) => !alreadyLinked.has(p.id));

  return (
    <main className="max-w-xl">
      <Link
        href="/workers"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Workers
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New worker
      </h1>

      <form action={createWorker} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Phase competencies
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(phases ?? []).map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="phases"
                  value={p.id}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="user_id"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Linked system user <span className="text-zinc-400">(optional)</span>
          </label>
          <select
            id="user_id"
            name="user_id"
            defaultValue=""
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Not a system user</option>
            {linkableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            For people who both log in and do production work (users already
            linked to a worker aren’t offered again).
          </p>
        </div>

        {error === "name" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Name is required.
          </p>
        )}
        {error === "save" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Could not save the worker — try again.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Create worker
          </button>
          <Link
            href="/workers"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
