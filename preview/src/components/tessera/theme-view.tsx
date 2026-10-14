import { knownTheme, THEME_IDS, type ThemeId } from "@/lib/tessera/themes";

export const THEMES = [
  { id: "water", label: "Water", line: "Ink field. Glass edge." },
  { id: "fire", label: "Fire", line: "The fracture that stays lit." },
  { id: "lightning", label: "Lightning", line: "A cold flash on the tile." },
  { id: "diamond", label: "Diamond", line: "Cut stone in daylight." },
  { id: "spiral", label: "Spiral", line: "The return, one shade higher." },
] as const;

export type { ThemeId };

export function applyTheme(id: string) {
  const next = knownTheme(id);
  document.documentElement.dataset.theme = next;
  window.localStorage.setItem("tessera-theme", next);
  const chip = document.querySelector('meta[name="theme-color"]');
  if (chip) chip.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--tessera-bg").trim());
  return next;
}

export function ThemeView({ current, choose }: { current: string; choose: (id: ThemeId) => void }) {
  const on = knownTheme(current);
  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Tessera Next</p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">Next</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">One theme, five marks. Tap a mark. The whole screen takes it, and this device keeps it.</p>
        <section className="mt-5 border border-border bg-surface p-4">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">On now</p>
          <p className="mt-1 font-display text-4xl tracking-tight capitalize">{on}</p>
          <p className="mt-2 text-sm text-fg">Header, talk, and the rooms use this mark.</p>
          <span className="mt-3 inline-flex h-11 items-center bg-accent px-3 text-sm text-accent-fg">Accent</span>
        </section>
        <ul className="mt-4 grid grid-cols-1 gap-2">
          {THEMES.map((theme) => {
            const chosen = on === theme.id;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  data-swatch={theme.id}
                  onClick={() => choose(theme.id)}
                  className={
                    chosen
                      ? "flex min-h-14 w-full items-center gap-3 border border-accent bg-bg px-3 py-2 text-left text-fg"
                      : "flex min-h-14 w-full items-center gap-3 border border-border bg-bg px-3 py-2 text-left text-fg"
                  }
                >
                  <span className="size-11 shrink-0 bg-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-none">{theme.label}</span>
                    <span className="mt-1 block text-sm text-muted">{theme.line}</span>
                  </span>
                  <span className={chosen ? "bg-accent px-2 py-1 text-xs text-accent-fg" : "text-xs text-muted"}>
                    {chosen ? "On" : "Use"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-subtle">{THEME_IDS.length} marks. An unknown name stays water.</p>
      </div>
    </div>
  );
}
