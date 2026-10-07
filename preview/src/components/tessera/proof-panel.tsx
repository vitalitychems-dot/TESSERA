import { useEffect, useState } from "react";
import { readProof, runProof, type ProofRow } from "@/lib/tessera/proof";

export function ProofPanel() {
  const [rows, setRows] = useState<ProofRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await readProof();
    setRows(result.rows);
  }

  async function check() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await runProof();
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check failed.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 90000);
    return () => window.clearInterval(id);
    // one real lookup on open, then every 90s while this tab stays open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = rows[rows.length - 1];

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.18em] text-subtle uppercase">Server log</p>
        <button type="button" onClick={() => void refresh()} className="text-sm text-accent">
          Reload saved log
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        One repository is checked when this page opens, then again every 90 seconds while it stays open. The log is saved where the disk allows. Nothing here is a person.
      </p>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      {last ? (
        <p className="mt-3 font-mono text-xs text-fg">
          Latest: {last.target} · {last.detail} · {last.at}
        </p>
      ) : (
        <p className="mt-3 text-sm text-fg">No check has completed yet.</p>
      )}
      <ul className="mt-3 flex max-h-48 flex-col gap-1 overflow-y-auto font-mono text-xs text-muted">
        {rows
          .slice()
          .reverse()
          .map((row) => (
            <li key={`${row.at}-${row.target}`}>
              {row.ok ? "ok" : "fail"} · {row.target} · {row.detail}
            </li>
          ))}
      </ul>
    </section>
  );
}
