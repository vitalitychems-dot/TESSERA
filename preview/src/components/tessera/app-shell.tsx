import { useEffect, useState } from "react";
import { Brain, Globe2, MessageCircle, Scale, LayoutGrid } from "lucide-react";
import { BoardView } from "./board-view";
import { Chamber } from "./chamber";
import { CouncilRoom } from "./council-room";
import { BrainView } from "./brain-view";
import { GitbookView } from "./gitbook-view";
import { GitbookAiView } from "./gitbook-ai-view";
import { ThemeView, applyTheme, type ThemeId } from "./theme-view";
import { RickView } from "./rick-view";
import { RoomsSheet, ROOMS } from "./rooms-sheet";
import { HouseLive } from "./house-live";
import { TesseraMark } from "./mark";
import { TESSERA } from "@/lib/tessera/identity";
import { SIGIL } from "@/lib/tessera/canon";
import { roomScreen } from "@/lib/tessera/wave-1";
import { type ViewId } from "@/lib/tessera/store";
import { startCity } from "@/lib/tessera/city-clock";

function settle(id: string): ViewId | "" {
  return roomScreen(id) as ViewId | "";
}

const PRIMARY: { id: ViewId | "rooms"; label: string; icon: typeof MessageCircle }[] = [
  { id: "chamber", label: "Talk", icon: MessageCircle },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "world", label: "World", icon: Globe2 },
  { id: "council", label: "Council", icon: Scale },
  { id: "rooms", label: "Rooms", icon: LayoutGrid },
];

export function AppShell() {
  const [place, setPlace] = useState<ViewId>("chamber");
  const [theme, setTheme] = useState<ThemeId>("water");
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("tessera-theme");
    const current = saved || document.documentElement.dataset.theme;
    if (current === "water" || current === "fire" || current === "lightning" || current === "diamond" || current === "spiral" || current === "house") setTheme(applyTheme(current));
    else setTheme(applyTheme("water"));
  }, []);

  useEffect(() => {
    startCity();
  }, []);

  useEffect(() => {
    function read() {
      const fromHash = window.location.hash.replace("#", "");
      const next = settle(fromHash);
      if (next) setPlace(next);
    }
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);

  function chooseTheme(id: ThemeId) {
    setTheme(applyTheme(id));
  }

  function open(id: ViewId) {
    const next = settle(id) || "chamber";
    setSheet(false);
    setPlace(next);
    window.sessionStorage.setItem("tessera-place", next);
    if (window.location.hash !== `#${next}`) window.history.pushState(null, "", `#${next}`);
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-transparent text-fg">
      <header className="z-30 flex shrink-0 items-center gap-3 border-b border-border bg-bg px-4 pt-[max(0.55rem,env(safe-area-inset-top))] pb-2">
        <img src={TESSERA.face} alt="" className="size-10 shrink-0 object-cover ring-1 ring-accent/60" style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TesseraMark className="size-4 text-accent" />
            <h1 className="font-display text-[1.7rem] leading-none tracking-tight">Tessera</h1>
          </div>
          <p className="mt-0.5 text-[10px] tracking-[0.22em] text-accent uppercase">{TESSERA.title} · {SIGIL.short}</p>
        </div>
        <button type="button" onClick={() => open("theme")} className="ml-auto flex h-11 items-center gap-2 border border-border bg-surface px-3 text-sm text-fg capitalize">
          <span className="size-3 bg-accent" />
          {theme}
        </button>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {place === "world" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <HouseLive />
          </div>
        ) : (
          <div key={place} className={place === "chamber" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
            {place === "council" ? <CouncilRoom /> : null}
            {place === "chamber" ? <Chamber /> : null}
            {place === "brain" ? <BrainView open={open} /> : null}
            {place === "gitbook" ? <GitbookView open={open} /> : null}
            {place === "gitbookai" ? <GitbookAiView /> : null}
            {place === "theme" ? <ThemeView current={theme} choose={chooseTheme} /> : null}
            {place === "rick" ? <RickView /> : null}
            {place === "board" ? <BoardView /> : null}
          </div>
        )}
        {sheet ? <RoomsSheet current={place} open={open} close={() => setSheet(false)} /> : null}
      </main>
      <nav className="z-30 grid shrink-0 grid-cols-5 border-t border-border bg-bg px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]" aria-label="Places">
        {PRIMARY.map((item) => {
          const on = item.id === "rooms" ? sheet : place === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.id === "rooms" ? setSheet((openSheet) => !openSheet) : open(item.id))}
              className={
                on
                  ? "flex min-h-11 flex-col items-center justify-center gap-0.5 border-t-2 border-accent py-1.5 text-accent"
                  : "flex min-h-11 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent py-1.5 text-subtle"
              }
            >
              <Icon className="size-[1.15rem]" strokeWidth={on ? 2.2 : 1.6} />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
