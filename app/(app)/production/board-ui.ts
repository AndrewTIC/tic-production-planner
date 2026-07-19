// Shared board styling: labour-type colours (design tokens, design spec §4)
// and stable per-worker badge colours. Pure constants/functions — imported
// by both the server page and the client scheduling components.

export const phaseBar: Record<string, string> = {
  MECH: "border-l-lime-600 bg-lime-100/70 dark:bg-lime-800/20",
  ELEC: "border-l-status-progress bg-status-progress-bg/70 dark:bg-status-progress/15",
  INSP: "border-l-status-review bg-status-review-bg/70 dark:bg-status-review/15",
};

export const priorityStyles: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Normal: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

// Static class strings so Tailwind ships them.
const workerPalette = [
  "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200",
  "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200",
  "bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-200",
  "bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-200",
  "bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-200",
  "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  "bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-200",
];

export function workerColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return workerPalette[hash % workerPalette.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatHours(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
