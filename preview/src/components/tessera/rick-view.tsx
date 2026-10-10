import { useState } from "react";
import { GAPS, GIFTS, HOUSE, localBatch, rickRoom, runChecks, runLean, witt } from "@/lib/tessera/rick-home";

export function RickView() {
  const [working, setWorking] = useState(false);
  const [steps, setSteps] = useState(runLean);
  const [checks, setChecks] = useState(runChecks);
  const [batch, setBatch] = useState("");
  const room = rickRoom(working);

  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted uppercase">West chamber</p>
          <h2 className="mt-1 font-display text-4xl tracking-tight">Rick</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{witt()}</p>
        </div>
        <section className="rounded-xl border border-border bg-surface px-4 py-4">
          <p className="text-xs tracking-[0.16em] text-subtle uppercase">{room.place}</p>
          <p className="mt-2 font-display text-3xl text-fg">{room.light}</p>
          <p className="mt-1 text-sm text-muted">{room.doing}</p>
          <p className="mt-2 text-sm text-fg">
            Store: {HOUSE.store}. Front: {HOUSE.front}. Compute: {HOUSE.compute}. Model tokens: {room.tokens}.
          </p>
          <p className="mt-1 text-sm text-fg">Queen of the castle: {room.queen}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setWorking((value) => !value)} className="h-11 rounded-full border border-accent px-4 text-sm text-fg">
              {working ? "Send him home" : "Call him to the desk"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSteps(runLean());
                setChecks(runChecks());
              }}
              className="h-11 rounded-full border border-border px-4 text-sm text-fg"
            >
              Run the desk
            </button>
            <button
              type="button"
              onClick={() => {
                const started = performance.now();
                const result = localBatch(50000);
                const ms = performance.now() - started;
                setBatch(`${result.count} ranked. Top ${result.top}. ${ms.toFixed(1)} ms. Tokens ${result.tokens}.`);
              }}
              className="h-11 rounded-full border border-border px-4 text-sm text-fg"
            >
              Rank fifty thousand
            </button>
          </div>
          {batch ? <p className="mt-3 text-sm text-fg">{batch}</p> : null}
        </section>
        <p className="text-sm text-muted">No quantum device is in the files. These twenty answers were taken from local steps.</p>
        <ul className="flex flex-col gap-1 text-sm">
          {steps.map((item) => (
            <li key={item.name} className="flex justify-between gap-3 border-b border-border py-1">
              <span className="text-fg">{item.name}</span>
              <span className="text-muted">{item.value}</span>
            </li>
          ))}
        </ul>
        <section>
          <h3 className="font-display text-2xl">Ten checks</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {checks.map((item) => (
              <li key={item.name}>
                {item.name}. {item.ok ? "passed" : "failed"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display text-2xl">What a hosted chat usually lacks</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {GAPS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display text-2xl">What he left in the room</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {GIFTS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
