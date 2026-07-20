// CSV export for the reports (spec §6.8) — these feed the existing Excel
// costing/MPA process, so the output has to survive Excel rather than merely
// be valid CSV.

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

// Excel treats a leading =, +, -, or @ as a formula. Prefixing with a
// single quote neutralises it without changing what a human reads — a BU
// number or part code beginning with "-" must not become a calculation.
function escapeCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  let text = String(raw);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/["\n\r,]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  // CRLF and a UTF-8 BOM: Excel on Windows needs the BOM to read accented
  // customer names correctly, and the office runs Windows throughout.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Reports are a point-in-time snapshot; never let one be cached and
      // handed back stale.
      "Cache-Control": "no-store",
    },
  });
}

// dd/mm/yyyy for humans (CLAUDE.md), and hours to two decimals so Excel
// sums them without surprises.
export function csvDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function csvHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}
