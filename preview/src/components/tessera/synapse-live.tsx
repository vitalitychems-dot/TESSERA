import { useEffect, useState } from "react";
import { flowLines } from "@/lib/tessera/retain";
import { stepLearn } from "@/lib/tessera/recursive-train";

export function SynapseLive() {
  const [step, setStep] = useState(0);
  const [again, setAgain] = useState(false);
  const now = stepLearn(step);
  const flows = flowLines();

  useEffect(() => {
    if (step >= now.total) return;
    const timer = window.setTimeout(() => setStep((value) => value + 1), 800);
    return () => window.clearTimeout(timer);
  }, [step, now.total]);

  return (
    <section className="mt-6 border-t border-border pt-4">
      <p className="text-[10px] tracking-[0.22em] text-accent uppercase">Memory and flow</p>
      <h3 className="font-display text-2xl tracking-tight">Ingest, then link</h3>
      <p className="mt-1 text-sm text-muted">
        A link appears only when a new line quotes the line before it. A Memory MCP server is not connected here. This is the local recall.
      </p>
      <p className="mt-3 text-sm text-fg">
        Kept {now.lines}. Recalled {now.recalled} of {now.total}. Links {now.links.length}.
        {step >= now.total ? " The next step adds nothing." : " Ingesting."}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {now.links.map((link) => (
          <li key={`${link.from}-${link.to}`} className="rounded-2xl border border-accent/50 px-3 py-2 text-sm text-fg">
            {link.from} <span className="text-accent">→</span> {link.to}
          </li>
        ))}
      </ul>
      <h4 className="mt-5 text-xs tracking-[0.18em] text-muted uppercase">Flows</h4>
      <ul className="mt-2 flex flex-col gap-2">
        {flows.map((line) => (
          <li key={line} className="text-sm text-fg">
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">{again ? "The same four again. The link count still stops at 3." : "The first pass is still running, or it has just finished."}</p>
      {step >= now.total ? (
        <button
          type="button"
          className="mt-3 h-11 rounded-full border border-border px-4 text-sm text-fg"
          onClick={() => {
            setAgain(true);
            setStep(0);
          }}
        >
          Run the same four again
        </button>
      ) : null}
    </section>
  );
}
