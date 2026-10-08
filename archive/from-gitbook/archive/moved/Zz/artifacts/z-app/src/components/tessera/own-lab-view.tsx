import { useState } from "react";
import { MEASURED, runOwnLab } from "@/lib/tessera/own-lab";
import { readLessons, runSafeLab } from "@/lib/tessera/lab-run";

const LINES = runOwnLab();

export function OwnLabView() {
  const passed = LINES.filter((line) => line.ok).length;
  const [lessons, setLessons] = useState("The lesson file is on the server. Open it to read the eight repositories.");
  const [ran, setRan] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await readLessons();
    setLessons(result.text);
  }

  async function again() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await runSafeLab();
      setRan(result.text);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs tracking-[0.18em] text-subtle uppercase">Her own eight</p>
      <p className="mt-2 text-sm text-fg">
        {passed} of {LINES.length} passed in this page. These are small local stand-ins, not the outside repositories.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void load()} className="rounded-lg border border-border px-3 py-2 text-sm text-fg">
          Read the eight
        </button>
        <button
          type="button"
          onClick={() => void again()}
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {busy ? "Running…" : "Run the safe checks"}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{lessons}</p>
      {ran ? <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{ran}</p> : null}
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {MEASURED.map((line) => (
          <li key={line.name}>
            <span className="text-fg">{line.name}. </span>
            <span className="text-muted">{line.detail}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {LINES.map((line) => (
          <li key={line.name} className="flex items-baseline justify-between gap-3">
            <span className="text-fg">{line.name}</span>
            <span className="text-right text-muted">{line.ok ? line.detail : `failed: ${line.detail}`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
