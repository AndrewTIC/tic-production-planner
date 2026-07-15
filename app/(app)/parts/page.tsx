import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function PartsPage() {
  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const { data: parts, error } = await supabase
    .from("parts")
    .select("id, part_number, description, created_at")
    .order("part_number");

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Parts
        </h1>
        {canWrite && (
          <Link
            href="/parts/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New part
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        ESD-built assemblies. A part is built many times — each build links
        back here, so the full build history of a part number stays in one
        place.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Could not load parts.
        </p>
      ) : !parts || parts.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No parts yet.
          {canWrite && " Create the first one with “New part”."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[32rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Part number
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Description
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {parts.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/parts/${p.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {p.part_number}
                    </Link>
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {p.description ?? ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatDate(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
