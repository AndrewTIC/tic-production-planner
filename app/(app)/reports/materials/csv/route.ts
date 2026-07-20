import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { getUserProfile } from "@/lib/auth";
import { materialsDue } from "../../queries";

export async function GET() {
  const auth = await getUserProfile();
  if (!auth) return new Response("Unauthorised", { status: 401 });

  const rows = await materialsDue();

  const csv = toCsv(rows, [
    { header: "Expected delivery", value: (r) => csvDate(r.expectedDelivery) },
    { header: "Days overdue", value: (r) => r.daysOverdue ?? "" },
    { header: "Component part number", value: (r) => r.componentPartNumber },
    { header: "Description", value: (r) => r.description },
    { header: "BU number", value: (r) => r.buNumber },
    { header: "Customer", value: (r) => r.customer },
    { header: "Build status", value: (r) => r.status },
    { header: "Build requested delivery", value: (r) => csvDate(r.requestedDelivery) },
  ]);

  return csvResponse(
    csv,
    `materials-due-${new Date().toISOString().slice(0, 10)}.csv`
  );
}
