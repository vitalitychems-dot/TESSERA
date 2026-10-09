import { Lattice } from "./lattice";
import { LearnView } from "./learn-view";
import { PulseView } from "./pulse-view";
import { SelfView } from "./self-view";
import { GROK_READY } from "@/lib/tessera/grok-ready";
import { HELD_PACKET, HELD_SECTIONS } from "@/lib/tessera/held-packet";
import { STUDY_LOG } from "@/lib/tessera/study-log";

const shelves = [
  { title: "Self", body: <SelfView /> },
  { title: "Lessons and pages", body: <LearnView /> },
  { title: "Pulse", body: <PulseView /> },
  { title: "Lattice", body: <Lattice /> },
] as const;

export function MemoryView() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Memory</p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Already hers</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Grok-ready is the body Father named. T44 at bb21498 says Everything is the public destination and she never wears his key. Everything at 3b36787 contains only the starter README and the migration instructions. The source copy is not finished. The natal vault was not opened.
        </p>
        <details open className="mt-4 rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fg">
            Who she is, candidate not signed off
          </summary>
          <pre className="max-h-80 overflow-y-auto border-t border-border px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-fg">
            {GROK_READY}
          </pre>
        </details>
        <details open className="mt-4 rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fg">
            Packet she holds, {HELD_SECTIONS.length} sections
          </summary>
          <ul className="px-4 pb-2 text-sm text-muted">
            {HELD_SECTIONS.map((s) => (
              <li key={s.title}>
                {s.title} — {s.chars.toLocaleString()} characters
              </li>
            ))}
          </ul>
          <pre className="max-h-[32rem] overflow-y-auto border-t border-border px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-fg">
            {HELD_PACKET}
          </pre>
        </details>
        <details className="mt-3 rounded-lg border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-fg">
            Study log, {STUDY_LOG.length} passes
          </summary>
          <ol className="max-h-[32rem] list-decimal overflow-y-auto px-8 py-3 text-sm leading-relaxed text-fg">
            {STUDY_LOG.map((text, i) => (
              <li key={i} className="mb-3">
                {text}
              </li>
            ))}
          </ol>
        </details>
      </div>
      {shelves.map((shelf) => (
        <details key={shelf.title} className="border-t border-border">
          <summary className="cursor-pointer px-4 py-4 text-sm font-medium text-fg sm:px-8">
            {shelf.title}
          </summary>
          <div className="max-h-[32rem] overflow-y-auto">{shelf.body}</div>
        </details>
      ))}
    </div>
  );
}
