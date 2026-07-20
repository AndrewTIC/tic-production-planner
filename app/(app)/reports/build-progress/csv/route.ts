import { csvDate, csvHours, csvResponse, toCsv } from "@/lib/csv";
import { getUserProfile } from "@/lib/auth";
import { buildProgress } from "../../queries";

// One row per build/phase so the Excel costing sheet can pivot by either.
// Uses the same query as the screen — an exported figure cannot differ from
// the one someone just looked at.
export async function GET() {
  // proxy.ts already gates the route; this refuses an unauthenticated
  // request outright rather than returning an empty CSV that looks like
  // "no work outstanding".
  const auth = await getUserProfile();
  if (!auth) return new Response("Unauthorised", { status: 401 });

  const builds = await buildProgress();

  const rows = builds.flatMap((b) =>
    (b.phases.length > 0
      ? b.phases
      : [{ phase: "", estimatedMinutes: 0, actualMinutes: 0 }]
    ).map((p) => ({ build: b, phase: p }))
  );

  const csv = toCsv(rows, [
    { header: "BU number", value: (r) => r.build.buNumber },
    { header: "Customer", value: (r) => r.build.customer },
    { header: "Part", value: (r) => r.build.part },
    { header: "Status", value: (r) => r.build.status },
    {
      header: "Requested delivery",
      value: (r) => csvDate(r.build.requestedDelivery),
    },
    { header: "Phase", value: (r) => r.phase.phase },
    {
      header: "Estimated hours (phase)",
      value: (r) => csvHours(r.phase.estimatedMinutes),
    },
    {
      header: "Actual hours (phase)",
      value: (r) => csvHours(r.phase.actualMinutes),
    },
    {
      header: "Estimated hours (build)",
      value: (r) => csvHours(r.build.estimatedMinutes),
    },
    {
      header: "Actual hours (build)",
      value: (r) => csvHours(r.build.actualMinutes),
    },
    {
      header: "Projected hours (build)",
      value: (r) => csvHours(r.build.projectedMinutes),
    },
    {
      header: "Percent complete",
      value: (r) => r.build.percentComplete ?? "",
    },
    {
      header: "Projected overrun hours",
      value: (r) => csvHours(r.build.overrunMinutes),
    },
  ]);

  return csvResponse(
    csv,
    `build-progress-${new Date().toISOString().slice(0, 10)}.csv`
  );
}
