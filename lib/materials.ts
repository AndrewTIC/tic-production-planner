// Material readiness badge (spec §6.5): complete, awaiting (with the LATEST
// expected date among outstanding lines), or not recorded. Informational
// only — must never block scheduling (CLAUDE.md rule 7).

export type MaterialItemLite = {
  booked_in: boolean;
  expected_delivery_date: string | null;
};

export type MaterialBadge =
  | { kind: "complete" }
  | { kind: "awaiting"; latest: string | null; outstanding: number }
  | { kind: "none" };

export function materialBadge(
  materialsComplete: boolean,
  items: MaterialItemLite[]
): MaterialBadge {
  if (materialsComplete) return { kind: "complete" };

  const outstanding = items.filter((i) => !i.booked_in);
  if (outstanding.length === 0) return { kind: "none" };

  const dates = outstanding
    .map((i) => i.expected_delivery_date)
    .filter((d): d is string => d !== null)
    .sort();

  return {
    kind: "awaiting",
    latest: dates.at(-1) ?? null,
    outstanding: outstanding.length,
  };
}
