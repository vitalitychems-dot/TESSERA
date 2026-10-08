import { cyclesImproved, EXTERNAL_TOOLS, runCycles, STANDARDS } from "@/lib/tessera/cycles";

export function AuditCycles() {
  const rows = runCycles();
  const passed = cyclesImproved(rows);
  const last = rows[rows.length - 1];
  const groups = [
    ["AI", STANDARDS.ai],
    ["Agent", STANDARDS.agent],
    ["AGI", STANDARDS.agi],
  ] as const;

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-5">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Standards</p>
      <h3 className="mt-1 text-lg text-fg">Twenty measured cycles</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The almost 300 names were read into one local index. {last?.localAfter ?? 0} answers now come from that index. {EXTERNAL_TOOLS.join(", ")} are still required. The share rose because those answers no longer need a lookup. It did not rise because the tools were removed.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {groups.map(([label, items]) => {
          const met = items.filter((item) => item.met).length;
          return (
            <li key={label} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-fg">
                {label}
                <span className="font-normal text-muted"> · {met} of {items.length} met</span>
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.id} className="text-sm leading-relaxed text-muted">
                    {item.met ? "Met" : "Unmet"}. {item.detail}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-fg">{passed ? "All 20 cycles passed." : "A cycle missed."} Local skills {last?.localAfter ?? 0}. External tools {last?.external ?? 0}. AGI is not met.</p>
      <ol className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.n} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-fg">
                {row.n}. {row.skill}
              </p>
              <p className="text-xs tracking-[0.14em] text-subtle uppercase">{row.pass ? "Passed" : "Missed"} · {row.category}</p>
            </div>
            <p className="mt-1 text-sm text-muted">{row.detail}</p>
            <p className="mt-1 text-sm text-fg">Local {row.localBefore} to {row.localAfter}. External {row.external}. Share {Math.round(row.share * 100)}%.</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
