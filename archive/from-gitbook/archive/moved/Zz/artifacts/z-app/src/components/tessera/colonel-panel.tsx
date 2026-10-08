import { useState } from "react";
import { runColonel } from "@/lib/tessera/colonel";

const SAMPLE = `PUSH 2
PUSH 3
ADD
HALT`;

export function ColonelPanel() {
  const [source, setSource] = useState(SAMPLE);
  const [stack, setStack] = useState<string[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function run() {
    const result = runColonel(source);
    setStack(result.stack);
    setOutput(result.output);
    setError(result.error ?? null);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Colonel stack</p>
      <p className="mt-2 text-sm text-muted">
        This runs the stack instructions from colonel-vm.ts in archive 8-2. ADD is arithmetic. It does not open a mesh, a radio, or a wallet.
      </p>
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={6}
        className="mt-3 w-full rounded-lg border border-border bg-bg p-3 font-mono text-sm text-fg"
      />
      <button
        type="button"
        onClick={run}
        className="mt-3 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
      >
        Run program
      </button>
      <p className="mt-3 font-mono text-sm text-fg">Stack: {stack.length ? stack.join(", ") : "empty"}</p>
      {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
      {output.length > 0 ? <p className="mt-1 font-mono text-xs text-muted">{output.join(" | ")}</p> : null}
    </section>
  );
}
