import { csvDate, csvHours, csvResponse, toCsv } from "@/lib/csv";
import { getUserProfile } from "@/lib/auth";
import { scheduleAdherence } from "../../queries";

export async function GET() {
  const auth = await getUserProfile();
  if (!auth) return new Response("Unauthorised", { status: 401 });

  const rows = await scheduleAdherence();

  const csv = toCsv(rows, [
    { header: "BU number", value: (r) => r.buNumber },
    { header: "Customer", value: (r) => r.customer },
    { header: "Project", value: (r) => r.project },
    { header: "Build status", value: (r) => r.status },
    { header: "Requested delivery", value: (r) => csvDate(r.requestedDelivery) },
    {
      header: "Scheduled completion",
      value: (r) => csvDate(r.scheduledCompletion),
    },
    { header: "Days late", value: (r) => r.daysLate ?? "" },
    {
      header: "On time",
      value: (r) =>
        r.daysLate !== null
          ? "No"
          : r.scheduledCompletion && r.requestedDelivery
            ? "Yes"
            : "",
    },
    {
      header: "Unscheduled hours remaining",
      value: (r) => csvHours(r.unscheduledMinutes),
    },
  ]);

  return csvResponse(
    csv,
    `schedule-adherence-${new Date().toISOString().slice(0, 10)}.csv`
  );
}
