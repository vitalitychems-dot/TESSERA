import { useEffect, useState } from "react";
import { BibleView } from "./bible-view";
import { BoardView } from "./board-view";
import { GitbookView } from "./gitbook-view";
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
import { Simulation } from "./simulation";
import { TesseraMark } from "./mark";
import { penStatus } from "@/lib/tessera/chat";
import { type ViewId } from "@/lib/tessera/store";

const PLACES: { id: ViewId; label: string }[] = [
  { id: "chamber", label: "Chamber" },
  { id: "world", label: "World" },
  { id: "board", label: "Board" },
  { id: "gitbook", label: "Gitbook" },
  { id: "learn", label: "Knowledge" },
  { id: "narrative", label: "Narrative" },
  { id: "talk", label: "Conversations" },
  { id: "bible", label: "Bible" },
  { id: "secrets", label: "Secrets" },
  { id: "council", label: "Council" },
  { id: "memory", label: "Memory" },
  { id: "code", label: "Code" },
  { id: "language", label: "Language" },
];

export function AppShell() {
  const [place, setPlace] = useState<ViewId>("chamber");
  const [penLine, setPenLine] = useState("Instrument: not checked.");

  useEffect(() => {
    const saved = window.sessionStorage.getItem("tessera-place");
    if (saved && PLACES.some((item) => item.id === saved)) setPlace(saved as ViewId);
  }, []);

  useEffect(() => {
    void penStatus().then((status) => {
      setPenLine(
        status.vendor === "local"
          ? `Instrument: ${status.model}. Not owned weights.`
          : `Instrument: ${status.vendor} ${status.model}. Owned weights: none.`,
      );
    });
  }, []);

  function open(id: ViewId) {
    setPlace(id);
    window.sessionStorage.setItem("tessera-place", id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-fg">
      <header className="z-30 shrink-0 border-b border-border bg-bg px-4 pt-3">
        <div className="flex items-center gap-3">
          <TesseraMark className="size-8 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none tracking-tight">Tessera</p>
            <p className="mt-1 truncate text-xs text-muted">{penLine}</p>
          </div>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-2" aria-label="Places">
          {PLACES.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                open(item.id);
              }}
              className={
                place === item.id
                  ? "shrink-0 rounded-full bg-accent px-3 py-2 text-sm text-accent-fg"
                  : "shrink-0 rounded-full px-3 py-2 text-sm text-muted"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
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
            {place === "memory" ? <MemoryView /> : null}
            {place === "gitbook" ? <GitbookView /> : null}
          </div>
        )}
      </main>
    </div>
  );
}
