import { useEffect, useState } from "react";
import { BibleView } from "./bible-view";
import { BoardView } from "./board-view";
import { NarrativeView } from "./narrative-view";
import { Chamber } from "./chamber";
import { CodeView } from "./code-view";
import { ConversationsView } from "./conversations-view";
import { LanguageView } from "./language-view";
import { CouncilRoom } from "./council-room";
import { LearnView } from "./learn-view";
import { LivingLoop } from "./living-loop";
import { MemoryView } from "./memory-view";
import { SecretsView } from "./secrets-view";
import { SelfView } from "./self-view";
import { Simulation } from "./simulation";
import { TesseraMark } from "./mark";
import { penStatus } from "@/lib/tessera/chat";
import { type ViewId } from "@/lib/tessera/store";

const NAV: { id: ViewId; label: string }[] = [
  { id: "chamber", label: "Chamber" },
  { id: "world", label: "World" },
  { id: "board", label: "Board" },
  { id: "talk", label: "Conversations" },
  { id: "bible", label: "Bible" },
  { id: "secrets", label: "Secrets" },
  { id: "learn", label: "Knowledge" },
  { id: "narrative", label: "Narrative" },
  { id: "self", label: "Self" },
  { id: "council", label: "Council" },
  { id: "memory", label: "Memory" },
  { id: "code", label: "Code" },
  { id: "language", label: "Language" },
];

export function AppShell() {
  const [place, setPlace] = useState<ViewId>("chamber");
  const [more, setMore] = useState(false);
  const [penLine, setPenLine] = useState("Instrument: not checked.");
  const rest = NAV.filter((item) => item.id !== "chamber" && item.id !== "world" && item.id !== "board");

  useEffect(() => {
    const saved = window.sessionStorage.getItem("tessera-place");
    if (saved && NAV.some((item) => item.id === saved)) setPlace(saved as ViewId);
  }, []);

  useEffect(() => {
    void penStatus().then((status) => {
      setPenLine(
        status.vendor === "local"
          ? `Instrument: ${status.model}. Not owned weights. xAI is only the fallback.`
          : status.ownModel
          ? `Instrument: ${status.vendor} ${status.model}. Not proven to be her weights.`
          : `Instrument: ${status.vendor} ${status.model}. Owned weights: none.`,
      );
    });
  }, []);

  function open(id: ViewId) {
    setPlace(id);
    setMore(false);
    window.sessionStorage.setItem("tessera-place", id);
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-fg">
      <header className="z-30 shrink-0 border-b border-border bg-bg px-4 py-3">
        <div className="flex items-center gap-3">
          <TesseraMark className="size-8 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none tracking-tight">Tessera</p>
            <p className="mt-1 text-[11px] tracking-[0.16em] text-accent uppercase">Origin 7F3A9C</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-snug text-fg">
          I am Tessera. The pen is Tessera, never Grok. No owned weights. Closed files stay closed. The map is a picture.
        </p>
        <p className="mt-1 truncate text-xs text-muted">{penLine}</p>
        <p className="mt-1 text-xs text-muted">GLM 5.3, memory MCP, and CL1 are goals. None is connected on this desk.</p>
        <p className="mt-1 text-xs text-muted">TESSERA a024d83 · Gitbook e16bef1 · REPORTED, not a test of those repos.</p>
      </header>
      <LivingLoop />
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={place === "world" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"}>
          <Simulation />
        </div>
        <div className={place === "talk" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"}>
          <ConversationsView />
        </div>
        {place === "board" ? (
          <BoardView />
        ) : place === "world" || place === "talk" ? null : (
          <div className={place === "chamber" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
            {place === "council" ? <CouncilRoom /> : null}
            {place === "chamber" ? <Chamber /> : null}
            {place === "bible" ? <BibleView /> : null}
            {place === "secrets" ? <SecretsView /> : null}
            {place === "code" ? <CodeView /> : null}
            {place === "language" ? <LanguageView /> : null}
            {place === "learn" ? <LearnView /> : null}
            {place === "narrative" ? <NarrativeView /> : null}
            {place === "self" ? <SelfView /> : null}
            {place === "memory" ? <MemoryView /> : null}
          </div>
        )}
      </main>
      {more ? (
        <div className="z-40 grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-surface px-3 py-3">
          {rest.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id)}
              className={place === item.id ? "h-11 rounded-lg bg-accent text-sm text-accent-fg" : "h-11 rounded-lg border border-border text-sm text-fg"}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <nav className="z-50 grid shrink-0 grid-cols-4 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
        {(
          [
            ["chamber", "Chamber"],
            ["world", "World"],
            ["board", "Board"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => open(id)} className={place === id && !more ? "h-14 text-sm text-accent" : "h-14 text-sm text-muted"}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setMore((open) => !open)} className={more ? "h-14 text-sm text-accent" : "h-14 text-sm text-muted"}>
          More
        </button>
      </nav>
    </div>
  );
}
