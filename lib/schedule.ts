// Date-only helpers for the scheduling board. Dates are YYYY-MM-DD strings
// throughout; arithmetic goes through Date.UTC so results are immune to the
// server's timezone and DST transitions.

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return toDateString(new Date());
}

export function isDateString(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateString(d);
}

// Monday of the week containing the date (weeks run Mon–Sun).
export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0 …
  return addDays(dateStr, -sinceMonday);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Saturday/Sunday: any work on these days is overtime (spec §6.4).
export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const dayLabelFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});

// "Mon 20/07" — column headers.
export function dayLabel(dateStr: string): string {
  const weekday = dayLabelFormat.format(new Date(`${dateStr}T00:00:00Z`));
  const [, month, day] = dateStr.split("-");
  return `${weekday} ${day}/${month}`;
}
