import { formatDate } from "@/lib/format";
import type { MaterialBadge } from "@/lib/materials";

// Shared badge for lists, build detail, and later the scheduling board.
// Informational only — never a gate (CLAUDE.md rule 7).
export function MaterialBadgeChip({ badge }: { badge: MaterialBadge }) {
  if (badge.kind === "complete") {
    return (
      <span className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
        Materials complete
      </span>
    );
  }
  if (badge.kind === "awaiting") {
    return (
      <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Awaiting{" "}
        {badge.latest ? `— exp. ${formatDate(badge.latest)}` : `(${badge.outstanding})`}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      Not recorded
    </span>
  );
}
