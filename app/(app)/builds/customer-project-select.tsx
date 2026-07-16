"use client";

import { useState } from "react";

type CustomerOption = { id: string; name: string };
type ProjectOption = { id: string; name: string; customer_id: string };

// Dependent selects: the project list filters to the chosen customer.
// Projects are optional; customer is mandatory on every build (spec §6.1).
// The server action re-validates the pairing — this component is UX only.
export function CustomerProjectSelect({
  customers,
  projects,
  defaultCustomerId,
  defaultProjectId,
  disabled = false,
}: {
  customers: CustomerOption[];
  projects: ProjectOption[];
  defaultCustomerId?: string;
  defaultProjectId?: string;
  disabled?: boolean;
}) {
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");

  const customerProjects = projects.filter((p) => p.customer_id === customerId);

  const selectClasses =
    "mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400";

  return (
    <>
      <div>
        <label
          htmlFor="customer_id"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Customer {!disabled && <span className="text-red-500">*</span>}
        </label>
        <select
          id="customer_id"
          name="customer_id"
          required
          disabled={disabled}
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setProjectId(""); // project belongs to the old customer
          }}
          className={selectClasses}
        >
          <option value="" disabled>
            Select a customer…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="project_id"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Project <span className="text-zinc-400">(optional)</span>
        </label>
        <select
          id="project_id"
          name="project_id"
          disabled={disabled || !customerId}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={selectClasses}
        >
          <option value="">No project</option>
          {customerProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!disabled && customerId && customerProjects.length === 0 && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            This customer has no projects — that’s fine, projects are an
            optional grouping.
          </p>
        )}
      </div>
    </>
  );
}
