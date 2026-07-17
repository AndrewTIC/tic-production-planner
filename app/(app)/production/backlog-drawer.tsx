"use client";

import { useEffect, useState } from "react";

// Slide-out drawer for unscheduled work (Andrew, 17 Jul 2026): the board
// keeps the full viewport; the backlog pops out over it on demand — the
// design spec's Level Two side-panel pattern (§17): overlay, never navigate,
// Esc / ✕ / click-away to close.
export function BacklogDrawer({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Unscheduled work
        <span className="ml-1.5 rounded-full bg-lime-100 px-1.5 py-0.5 text-xs font-semibold text-lime-800 dark:bg-lime-800 dark:text-lime-100">
          {count}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Unscheduled work"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-96 max-w-[90vw] overflow-y-auto border-l border-zinc-200 bg-white p-4 shadow-(--shadow-2) dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Unscheduled work
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
