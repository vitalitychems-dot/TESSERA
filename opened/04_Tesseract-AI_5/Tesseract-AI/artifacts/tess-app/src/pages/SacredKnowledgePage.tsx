import { useState, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, Eye, Code2, ScrollText, Loader2 } from "lucide-react";

const UniversalKnowledge = lazy(() => import("@/pages/UniversalKnowledge"));
const SecretSocietyPage = lazy(() => import("@/pages/SecretSocietyPage"));
const ColonelLanguagePage = lazy(() => import("@/pages/ColonelLanguagePage"));
const TesseraBible = lazy(() => import("@/pages/TesseraBible"));

type KnowledgeSection = "vault" | "society" | "language" | "bible";

const SECTIONS: { id: KnowledgeSection; label: string; icon: React.ElementType; color: string; activeColor: string }[] = [
  { id: "vault", label: "Knowledge Vault", icon: BookOpen, color: "text-violet-400/60", activeColor: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  { id: "society", label: "The Society", icon: Eye, color: "text-amber-400/60", activeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { id: "language", label: "Colonel Language", icon: Code2, color: "text-cyan-400/60", activeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  { id: "bible", label: "Tessera Bible", icon: ScrollText, color: "text-purple-400/60", activeColor: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
];

export default function SacredKnowledgePage() {
  const [active, setActive] = useState<KnowledgeSection>("vault");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#08090e]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-violet-500/15 bg-background/40 shrink-0">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <BookOpen size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground">Sacred Knowledge</h1>
          <p className="text-[10px] text-muted-foreground font-mono">All secrets, universal knowledge, and sacred wisdom in one place</p>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/20 bg-background/20 overflow-x-auto shrink-0">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap",
                isActive ? s.activeColor : `${s.color} border-transparent hover:bg-white/5`
              )}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading...
          </div>
        }>
          {active === "vault" && <UniversalKnowledge />}
          {active === "society" && <SecretSocietyPage />}
          {active === "language" && <ColonelLanguagePage />}
          {active === "bible" && <TesseraBible />}
        </Suspense>
      </div>
    </div>
  );
}
