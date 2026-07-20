import { csvHours, csvResponse, toCsv } from "@/lib/csv";
import { getUserProfile } from "@/lib/auth";
import { addDays, isDateString, mondayOf, today } from "@/lib/schedule";
import { utilisation } from "../../queries";

// Overtime classification is carried through to the export so Finance can
// apply the 1.5x and 2x rates — the whole point of splitting the columns.
export async function GET(request: Request) {
  const auth = await getUserProfile();
  if (!auth) return new Response("Unauthorised", { status: 401 });

  const url = new URL(request.url);
  const by = url.searchParams.get("by") === "phase" ? "phase" : "worker";
  const fromParam = url.searchParams.get("from") ?? undefined;
  const toParam = url.searchParams.get("to") ?? undefined;
  const from = isDateString(fromParam)
    ? fromParam
    : addDays(mondayOf(today()), -21);
  const to = isDateString(toParam) ? toParam : addDays(from, 27);

  const rows = await utilisation(from, to, by);

  const csv = toCsv(rows, [
    { header: by === "worker" ? "Worker" : "Phase", value: (r) => r.label },
    { header: "Period from", value: () => from.split("-").reverse().join("/") },
    { header: "Period to", value: () => to.split("-").reverse().join("/") },
    { header: "Standard hours", value: (r) => csvHours(r.standardMinutes) },
    { header: "Overtime 1.5x hours", value: (r) => csvHours(r.ot15Minutes) },
    { header: "Overtime 2x hours", value: (r) => csvHours(r.ot2Minutes) },
    {
      header: "Total booked hours",
      value: (r) =>
        csvHours(r.standardMinutes + r.ot15Minutes + r.ot2Minutes),
    },
    { header: "Available hours", value: (r) => csvHours(r.availableMinutes) },
    { header: "Utilisation percent", value: (r) => r.utilisation ?? "" },
  ]);

  return csvResponse(csv, `utilisation-${by}-${from}-to-${to}.csv`);
}
