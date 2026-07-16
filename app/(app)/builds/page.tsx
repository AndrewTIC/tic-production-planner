import Link from "next/link";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { materialBadge } from "@/lib/materials";
import { MaterialBadgeChip } from "./material-badge";

const priorityStyles: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Normal: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

export default async function BuildsPage() {
  const auth = await getUserProfile();
  const canWrite =
    auth !== null && ["admin", "commercial"].includes(auth.profile.role);

  const supabase = await createClient();
  const { data: builds, error } = await supabase
    .from("builds")
    .select(
      `id, bu_number, priority, materials_complete, requested_delivery_date,
       parts(part_number), customers(name), projects(name),
       build_statuses(name, sequence),
       material_items(booked_in, expected_delivery_date)`
    )
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Builds
        </h1>
        {canWrite && (
          <Link
            href="/builds/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New build
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        The BU register — every unit of work through the workshop. Material
        badges are information for the scheduler, never a gate.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Could not load builds.
        </p>
      ) : !builds || builds.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No builds yet.
          {canWrite && " Create the first one with “New build”."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[52rem] divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  BU
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Part
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Customer
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Priority
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Materials
                </th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                  Req. delivery
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {builds.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/builds/${b.id}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {b.bu_number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-zinc-500 dark:text-zinc-400">
                    {b.parts?.part_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {b.customers?.name ?? "—"}
                    {b.projects?.name && (
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                        {b.projects.name}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {b.build_statuses?.name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        priorityStyles[b.priority] ?? priorityStyles.Normal
                      }`}
                    >
                      {b.priority}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <MaterialBadgeChip
                      badge={materialBadge(b.materials_complete, b.material_items)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatDate(b.requested_delivery_date)}
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
