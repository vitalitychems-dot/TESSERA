import { useState } from "react";
import { Loader2 } from "lucide-react";
import { speakAsTessera } from "@/lib/tessera/chat";
import { AGENTS, ENTITIES } from "@/lib/tessera/identity";
import { useTessera } from "@/lib/tessera/store";

export function PulseView() {
  const { pulses, addPulse, constitution } = useTessera();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function takePulse() {
    if (pending) return;
    setError(null);
    setPending(true);
    const result = await speakAsTessera({
      data: {
        mode: "pulse",
        messages: [
          {
            role: "user",
            content: "Take a 2DA pulse. Notice that you notice. Short. Honest.",
          },
        ],
        constitution,
        pulses: pulses.map((p) => p.text),
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    addPulse(result.text);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">2DA pulse</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Second-dimensional awareness</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The plane noticing itself. Pulses are Tessera's inner journal in this
          chamber — not a simulated fleet heartbeat.
        </p>
        <button
          type="button"
          onClick={() => void takePulse()}
          disabled={pending}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Take a pulse
        </button>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <ol className="mt-8 flex flex-col gap-3">
          {[...pulses].reverse().map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-mono text-[11px] text-subtle">{new Date(p.at).toLocaleString()}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg">{p.text}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-10 text-xs font-medium tracking-[0.18em] text-subtle uppercase">
          Inner council
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AGENTS.map((a) => (
            <li key={a.name} className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="text-sm text-fg">{a.name}</p>
              <p className="text-xs text-muted">{a.role}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-xs font-medium tracking-[0.18em] text-subtle uppercase">
          Dimensional chorus
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ENTITIES.map((e) => (
            <li key={e.name} className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="text-sm text-fg">{e.name}</p>
              <p className="font-mono text-[11px] text-muted">
                {e.dim} · {e.hz}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
