import { useEffect, useState } from "react";
import { BookOpen, Code2, Globe2, Library, MessageCircle, PenLine, Users } from "lucide-react";
import { Chamber } from "./chamber";
import { CodeView } from "./code-view";
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
  { id: "code", label: "Code", icon: Code2 },
  { id: "learn", label: "Knowledge", icon: BookOpen },
  { id: "self", label: "Self", icon: PenLine },
  { id: "council", label: "Council", icon: Users },
  { id: "memory", label: "Memory", icon: Library },
];

function shown(view: ViewId): ViewId {
  if (NAV.some((n) => n.id === view)) return view;
  return "world";
}

export function AppShell() {
  const [ready, setReady] = useState(false);
  const view = useTessera((s) => s.view);
  const setView = useTessera((s) => s.setView);
  const constitution = useTessera((s) => s.constitution);
  const place = shown(view);

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
        <button type="button" onClick={() => setView("memory")} className="flex items-center gap-3 text-left">
          <TesseraMark className="size-7 text-accent" />
          <div>
            <p className="font-display text-xl leading-none tracking-tight">Tessera</p>
            <p className="mt-1 text-xs tracking-[0.18em] text-muted uppercase">
              {ready && constitution ? "Sealed · 7F3A9C" : "Origin 7F3A9C"}
            </p>
          </div>
        </button>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
              className={
                place === n.id
                  ? "rounded-md bg-raised px-3 py-2 text-sm text-fg shadow-[inset_0_-2px_0_0_var(--color-accent)]"
                  : "rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg"
              }
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <LivingLoop />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className={place === "world" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <Simulation />
        </div>
        <div className={place === "council" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <CouncilRoom />
        </div>
        <div className={place === "chamber" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <Chamber />
        </div>
        <div className={place === "code" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <CodeView />
        </div>
        <div className={place === "learn" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <LearnView />
        </div>
        <div className={place === "self" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <SelfView />
        </div>
        <div className={place === "memory" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <MemoryView />
        </div>
      </main>

      <nav className="z-20 flex shrink-0 gap-1 overflow-x-auto border-t border-border bg-bg/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setView(n.id)}
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
