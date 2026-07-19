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

// Elapsed time since clock-on, e.g. "2h 14m". Ticks so the operator can see
// the entry is live.
export function Elapsed({ startedAt }: { startedAt: string }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const mins = Math.max(
        0,
        Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
      );
      setLabel(`${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="tabular-nums">{label}</span>;
}
