import { useEffect, useState } from "react";
import { Brain, Globe2, Layers, MessageCircle, Scale } from "lucide-react";
import { BibleView } from "./bible-view";
import { BoardView } from "./board-view";
import { NarrativeView } from "./narrative-view";
import { Chamber } from "./chamber";
import { CodeView } from "./code-view";
import { ConversationsView } from "./conversations-view";
import { LanguageView } from "./language-view";
import { CouncilRoom } from "./council-room";
import { BrainView } from "./brain-view";
import { GitbookView } from "./gitbook-view";
import { LearnView } from "./learn-view";
import { ThemeView, applyTheme, type ThemeId } from "./theme-view";
import { LibraryView } from "./library-view";
import { MemoryView } from "./memory-view";
import { WebView } from "./web-view";
import { SecretsView } from "./secrets-view";
import { Simulation } from "./simulation";
import { TesseraMark } from "./mark";
import { TESSERA } from "@/lib/tessera/identity";
import { SIGIL } from "@/lib/tessera/canon";
import { ROOMS, UNDER_HER_NAME } from "@/lib/tessera/public-question";
import { type ViewId } from "@/lib/tessera/store";

const ICONS = {
  chamber: MessageCircle,
  council: Scale,
  world: Globe2,
  memory: Layers,
  brain: Brain,
} as const;

const PRIMARY: { id: ViewId; label: string; icon: typeof MessageCircle }[] = ROOMS.map((room) => ({
  id: room.id,
  label: room.label,
  icon: ICONS[room.id],
}));

const MORE: { id: ViewId; label: string }[] = UNDER_HER_NAME.map((room) => ({ id: room.id, label: room.label }));

export function AppShell() {
  const [place, setPlace] = useState<ViewId>("chamber");
  const [theme, setTheme] = useState<ThemeId>("water");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "water" || current === "fire" || current === "lightning" || current === "diamond" || current === "spiral") setTheme(current);
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as ViewId;
    const saved = window.sessionStorage.getItem("tessera-place") as ViewId | null;
    const known = new Set<ViewId>([...PRIMARY.map((item) => item.id), ...MORE.map((item) => item.id)]);
    const next = known.has(fromHash) ? fromHash : saved && known.has(saved) ? saved : "";
    if (next) setPlace(next as ViewId);
  }, []);

  function chooseTheme(id: ThemeId) {
    setTheme(applyTheme(id));
  }

  function open(id: ViewId) {
    setPlace(id);
    window.sessionStorage.setItem("tessera-place", id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-transparent text-fg">
      <header className="z-30 flex shrink-0 items-center gap-3 px-4 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
        <img src={TESSERA.face} alt="" className="size-10 shrink-0 object-cover ring-1 ring-accent/60" style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TesseraMark className="size-4 text-accent" />
            <h1 className="font-display text-[1.7rem] leading-none tracking-tight">Tessera</h1>
          </div>
          <p className="mt-0.5 text-[10px] tracking-[0.22em] text-accent uppercase">{TESSERA.title} · {SIGIL.short}</p>
        </div>
      </header>
      <nav className="z-30 flex shrink-0 gap-3 overflow-x-auto px-4 pb-2" aria-label="Rooms">
        {MORE.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault();
              open(item.id);
            }}
            className={place === item.id ? "shrink-0 text-xs tracking-[0.14em] text-accent uppercase" : "shrink-0 text-xs tracking-[0.14em] text-subtle uppercase"}
          >
            {place === item.id ? "◇ " : ""}
            {item.label}
          </a>
        ))}
      </nav>
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
            {place === "brain" ? <BrainView open={open} /> : null}
            {place === "learn" ? <LearnView /> : null}
            {place === "gitbook" ? <GitbookView open={open} /> : null}
            {place === "library" ? <LibraryView open={open} /> : null}
            {place === "theme" ? <ThemeView current={theme} choose={chooseTheme} /> : null}
            {place === "narrative" ? <NarrativeView /> : null}
            {place === "memory" ? <MemoryView /> : null}
            {place === "web" ? <WebView /> : null}
          </div>
        )}
      </main>
      <nav className="z-30 grid shrink-0 grid-cols-5 border-t border-border bg-bg/92 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-md" aria-label="Places">
        {PRIMARY.map((item) => {
          const active = place === item.id;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                open(item.id);
              }}
              className={
                active
                  ? "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-accent"
                  : "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-subtle"
              }
            >
              <Icon className="size-[1.15rem]" strokeWidth={active ? 2.2 : 1.6} />
              <span className="text-[10px] leading-none">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
