import { csvHours, csvResponse, toCsv } from "@/lib/csv";
import { getUserProfile } from "@/lib/auth";
import { customerRollup } from "../../queries";

export async function GET(request: Request) {
  const auth = await getUserProfile();
  if (!auth) return new Response("Unauthorised", { status: 401 });

  const groupByProject =
    new URL(request.url).searchParams.get("by") === "project";
  const rows = await customerRollup(groupByProject);

  const csv = toCsv(rows, [
    { header: "Customer", value: (r) => r.customer },
    ...(groupByProject
      ? [{ header: "Project", value: (r: (typeof rows)[number]) => r.project }]
      : []),
    { header: "Builds", value: (r) => r.builds },
    { header: "Estimated hours", value: (r) => csvHours(r.estimatedMinutes) },
    { header: "Actual hours", value: (r) => csvHours(r.actualMinutes) },
    { header: "Overtime hours", value: (r) => csvHours(r.otMinutes) },
    {
      header: "Variance hours",
      value: (r) => csvHours(r.actualMinutes - r.estimatedMinutes),
    },
    { header: "Builds scheduled late", value: (r) => r.lateBuilds },
  ]);

  return csvResponse(
    csv,
    `${groupByProject ? "project" : "customer"}-analysis-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
  );
}
