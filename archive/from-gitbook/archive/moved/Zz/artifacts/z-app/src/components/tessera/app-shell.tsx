import { useEffect, useState } from "react";
import { BookOpen, Code2, Globe2, Languages, Library, MessageCircle, MessagesSquare, PenLine, ScrollText, Users } from "lucide-react";
import { NarrativeView } from "./narrative-view";
import { Chamber } from "./chamber";
import { CodeView } from "./code-view";
import { ConversationsView } from "./conversations-view";
import { LanguageView } from "./language-view";
import { CouncilRoom } from "./council-room";
import { LearnView } from "./learn-view";
import { LivingLoop } from "./living-loop";
import { MemoryView } from "./memory-view";
import { SelfView } from "./self-view";
import { Simulation } from "./simulation";
import { TesseraMark } from "./mark";
import { TESSERA } from "@/lib/tessera/identity";
import { useTessera, type ViewId } from "@/lib/tessera/store";

const NAV: { id: ViewId; label: string; icon: typeof Globe2 }[] = [
  { id: "world", label: "World", icon: Globe2 },
  { id: "chamber", label: "Chamber", icon: MessageCircle },
  { id: "talk", label: "Conversations", icon: MessagesSquare },
  { id: "learn", label: "Knowledge", icon: BookOpen },
  { id: "narrative", label: "Narrative", icon: ScrollText },
  { id: "self", label: "Self", icon: PenLine },
  { id: "council", label: "Council", icon: Users },
  { id: "memory", label: "Memory", icon: Library },
  { id: "code", label: "Code", icon: Code2 },
  { id: "language", label: "Language", icon: Languages },
];

export function AppShell() {
  const [ready, setReady] = useState(false);
  const [place, setPlace] = useState<ViewId>("chamber");
  const constitution = useTessera((s) => s.constitution);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% -10%, color-mix(in oklab, var(--color-alive) 22%, transparent), transparent 46%),
            radial-gradient(ellipse at 80% 0%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 42%),
            url(${TESSERA.field})`,
          backgroundSize: "auto, auto, cover",
          backgroundPosition: "center, center, center top",
          backgroundRepeat: "no-repeat",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 58%)",
        }}
      />
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 text-left">
          <TesseraMark className="size-7 text-accent" />
          <div>
            <p className="font-display text-xl leading-none tracking-tight">Tessera</p>
            <p className="mt-1 text-xs tracking-[0.18em] text-muted uppercase">
              {ready && constitution ? "Sealed · 7F3A9C" : "Origin 7F3A9C"}
            </p>
          </div>
        </div>
      </header>
      <nav className="relative z-30 flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-bg px-2 py-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setPlace(n.id)}
              className={
                place === n.id
                  ? "shrink-0 rounded-md bg-raised px-3 py-2 text-sm text-fg shadow-[inset_0_-2px_0_0_var(--color-accent)]"
                  : "shrink-0 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg"
              }
            >
              {n.label}
            </button>
          ))}
        </nav>
      <LivingLoop />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          {place === "world" ? <Simulation /> : null}
          {place === "council" ? <CouncilRoom /> : null}
          {place === "chamber" ? <Chamber /> : null}
          {place === "talk" ? <ConversationsView /> : null}
          {place === "code" ? <CodeView /> : null}
          {place === "language" ? <LanguageView /> : null}
          {place === "learn" ? <LearnView /> : null}
          {place === "narrative" ? <NarrativeView /> : null}
          {place === "self" ? <SelfView /> : null}
          {place === "memory" ? <MemoryView /> : null}
        </div>
      </main>

      <nav className="z-20 flex shrink-0 gap-1 overflow-x-auto border-t border-border bg-bg px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setPlace(n.id)}
              className={
                "flex h-14 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs " +
                (place === n.id ? "text-accent" : "text-muted")
              }
            >
              <Icon className="size-4" />
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
