"use client";

import { useEffect, useState } from "react";

// Wall clock in the kiosk header. 24-hour (CLAUDE.md). Rendered empty on
// the server so the markup matches on hydration, then ticks each second.
export function KioskClock() {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Europe/London",
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="ml-auto text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
      {now}
    </span>
  );
}

// Worked time since clock-on, e.g. "2h 14m" — net of the unpaid 12:00–13:00
// break, so the counter matches what the entry will actually be worth
// (CLAUDE.md rule 5). The database is the source of truth via
// worked_minutes(); this mirrors it only for the live display of an entry
// that has not ended yet, and must stay in step with it.
function breakMinutesBetween(start: Date, end: Date): number {
  let deducted = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const lunchStart = new Date(cursor);
    lunchStart.setHours(12, 0, 0, 0);
    const lunchEnd = new Date(cursor);
    lunchEnd.setHours(13, 0, 0, 0);
    const overlap =
      Math.min(end.getTime(), lunchEnd.getTime()) -
      Math.max(start.getTime(), lunchStart.getTime());
    if (overlap > 0) deducted += overlap / 60000;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.floor(deducted);
}

export function Elapsed({ startedAt }: { startedAt: string }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const start = new Date(startedAt);
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 60000);
      const mins = Math.max(0, elapsed - breakMinutesBetween(start, now));
      setLabel(`${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="tabular-nums">{label}</span>;
}
