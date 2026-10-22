import { useState } from "react";
import { DESK, deskPassed, runDesk, type DrillRow } from "@/lib/tessera/craft";

export function DeskDrill() {
  const [rows, setRows] = useState<DrillRow[]>(() => runDesk());
  const passed = deskPassed(rows);

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-5">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Desk</p>
      <h3 className="mt-1 text-lg text-fg">Six agents, one Tessera</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        TESSERA keeps her records. Gitbook keeps the notes. The store is not in this room. These agents are jobs, not extra models. A pass here is a sealed drill.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {DESK.map((skill) => {
          const row = rows.find((item) => item.id === skill.id);
          return (
            <li key={skill.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-fg">
                  {skill.agent}
                  <span className="font-normal text-muted"> · {skill.name}</span>
                </p>
                <p className="text-xs tracking-[0.14em] text-subtle uppercase">{row?.pass ? "Passed" : "Missed"}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{skill.job}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg">{row?.note}</p>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="mt-4 min-h-11 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg"
        onClick={() => setRows(runDesk())}
      >
        {passed ? "Drill passed. Run it again." : "Run the drill"}
      </button>
    </section>
  );
}
