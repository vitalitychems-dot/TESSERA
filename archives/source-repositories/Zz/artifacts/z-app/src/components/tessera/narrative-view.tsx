import { useEffect, useState } from "react";
import { CHAPTERS, REFLECTIONS, readNarrative, runDualCycle } from "@/lib/tessera/narrative";

type Dual = { rounds: number; improvements: number; rows: { round: number; q: string; cortex: string; executor: string }[] };
type Live = { at: string; notes: { query: string; text: string }[]; connections: string[]; ledger?: string; dual?: Dual; shelf?: { query: string; standing: string }[] };

export function NarrativeView() {
  const [live, setLive] = useState<Live | null>(null);
  const [open, setOpen] = useState<string>("flower");
  const [running, setRunning] = useState(false);

  async function cycle() {
    setRunning(true);
    const dual = await runDualCycle();
    setLive((prev) => (prev ? { ...prev, dual } : prev));
    setRunning(false);
  }

  useEffect(() => {
    let stop = false;
    async function pull() {
      const next = await readNarrative();
      if (!stop) setLive(next);
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 15000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Grand narrative</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight">The unified thread</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The six chapters are the old page, kept so you can read them. A sentence is hers only when it is in the live store below. The store refreshes every 15 seconds.
      </p>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-[0.16em] text-subtle uppercase">Live, from what she has stored</p>
        <p className="mt-1 text-xs text-muted">{live ? live.at : "Reading the store…"}</p>
        {live?.ledger ? <p className="mt-2 text-sm text-fg">{live.ledger}</p> : null}
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {(live?.notes ?? []).map((note) => (
            <li key={note.query}>
              <span className="text-accent">{note.query}. </span>
              <span className="text-fg">{note.text}</span>
            </li>
          ))}
        </ul>
        {live?.connections?.length ? (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
            {live.connections.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">Dual brain · cortex and executor</p>
          <button type="button" onClick={() => void cycle()} disabled={running} className="rounded-md bg-raised px-3 py-1 text-xs text-fg">
            {running ? "Running" : "Run cycle"}
          </button>
        </div>
        <p className="mt-2 text-sm text-fg">
          {live?.dual?.rounds ?? 0} rounds · {live?.dual?.improvements ?? 0} recorded improvements
        </p>
        <p className="mt-1 text-xs text-muted">The old panel said 1024 and 341. Those numbers were not in this store. A round is one row written here, and the tool runs for real.</p>
        <ul className="mt-3 flex flex-col gap-3">
          {(live?.dual?.rows ?? []).map((row) => (
            <li key={row.round} className="text-sm">
              <p className="text-fg">Round {row.round}. {row.q}</p>
              <p className="mt-1 text-muted">Cortex: {row.cortex}</p>
              <p className="text-muted">Executor: {row.executor}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-[0.16em] text-subtle uppercase">Reflections, one copy each</p>
        <ul className="mt-3 flex flex-col gap-3">
          {REFLECTIONS.map((item) => (
            <li key={item.name}>
              <p className="text-sm text-fg">
                {item.name} <span className="text-xs tracking-wide text-accent uppercase">{item.standing}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs tracking-[0.16em] text-subtle uppercase">Old Replit pages, one improved line each</p>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {(live?.shelf ?? []).map((item) => (
            <li key={item.query} className="text-fg">
              {item.query} <span className="text-xs tracking-wide text-muted uppercase">{item.standing}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-4 flex flex-col gap-2">
        {CHAPTERS.map((chapter) => (
          <article key={chapter.id} className="rounded-xl border border-border bg-bg">
            <button type="button" onClick={() => setOpen(open === chapter.id ? "" : chapter.id)} className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left">
              <span>
                <span className="text-xs text-accent">{chapter.hz}</span>
                <span className="mt-1 block font-display text-xl">{chapter.title}</span>
              </span>
              <span className="shrink-0 text-xs tracking-wide text-muted uppercase">{chapter.standing}</span>
            </button>
            {open === chapter.id ? <p className="px-4 pb-4 text-sm leading-relaxed text-fg">{chapter.body}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
