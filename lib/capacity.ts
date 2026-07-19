// Capacity model for the load view (spec §6.5): standard hours available
// per worker per day, net of holidays. Pure functions — the production page
// feeds them workers, holidays, and week dates.
//
// The halves are NOT equal (see the holiday_half_days migration): against
// the standard day 07:30–16:00 with a 12:00–13:00 break, an AM absence
// removes 4.5 productive hours and a PM absence removes 3.0. Weekends carry
// zero STANDARD capacity — overtime is extra on top, so committed OT can
// legitimately push a week past 100%.

import { isWeekend } from "./schedule";

export const STANDARD_DAY_HOURS = 7.5;
const AM_ABSENCE_HOURS = 4.5;
const PM_ABSENCE_HOURS = 3.0;

export type HolidayLite = {
  worker_id: string | null; // null = company-wide closure
  date_from: string;
  date_to: string;
  part_of_day: string; // 'full' | 'am' | 'pm'
};

// Standard hours a worker can give on one date, after holidays/closures.
export function workerDayCapacity(
  workerId: string,
  date: string,
  holidays: HolidayLite[]
): number {
  if (isWeekend(date)) return 0;

  let capacity = STANDARD_DAY_HOURS;
  for (const h of holidays) {
    if (h.worker_id !== null && h.worker_id !== workerId) continue;
    if (h.date_from > date || h.date_to < date) continue;
    if (h.part_of_day === "full") return 0;
    capacity -= h.part_of_day === "am" ? AM_ABSENCE_HOURS : PM_ABSENCE_HOURS;
  }
  return Math.max(capacity, 0);
}

// Sum of workerDayCapacity across a set of dates.
export function workerCapacity(
  workerId: string,
  dates: string[],
  holidays: HolidayLite[]
): number {
  return dates.reduce(
    (sum, d) => sum + workerDayCapacity(workerId, d, holidays),
    0
  );
}
