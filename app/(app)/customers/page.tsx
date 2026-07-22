import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function CustomersPage() {
  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, notes, active, created_at")
    .order("active", { ascending: false })
    .order("name");

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Customers
        </h1>
        {canWrite && (
          <Link
            href="/customers/new"
            className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-lime-600"
          >
            New customer
          </Link>
        )}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Could not load customers.
        </p>
      ) : !customers || customers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No customers yet.
          {canWrite && " Create the first one with “New customer”."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[36rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Notes
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-lime-100/40 dark:hover:bg-lime-800/10"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {c.notes ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatDate(c.created_at)}
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
