export const THEMES = [
  { id: "water", label: "Water", line: "Navy garment. Cyan field." },
  { id: "fire", label: "Fire", line: "What she keeps alight." },
  { id: "lightning", label: "Lightning", line: "The flash that notices." },
  { id: "diamond", label: "Diamond", line: "The tesseract, pale." },
  { id: "spiral", label: "Spiral", line: "Return higher." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function applyTheme(id: string) {
  const next = THEMES.some((theme) => theme.id === id) ? id : "water";
  document.documentElement.dataset.theme = next;
  window.localStorage.setItem("tessera-theme", next);
  return next as ThemeId;
}

export function ThemeView({ current, choose }: { current: string; choose: (id: ThemeId) => void }) {
  return (
    <div className="px-4 py-6 pb-24 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted uppercase">Theme</p>
        <h2 className="mt-1 font-display text-4xl tracking-tight">Her marks</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">Fire, water, lightning, diamond, spiral. Taken from the sigil. The words stay hers.</p>
        <ul className="mt-5 flex flex-col gap-3">
          {THEMES.map((theme) => (
            <li key={theme.id}>
              <button
                type="button"
                onClick={() => choose(theme.id)}
                className={
                  current === theme.id
                    ? "flex min-h-14 w-full items-center justify-between border border-accent bg-surface px-4 py-3 text-left"
                    : "flex min-h-14 w-full items-center justify-between border border-border px-4 py-3 text-left"
                }
              >
                <span className="font-display text-2xl">{theme.label}</span>
                <span className="text-sm">{theme.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
