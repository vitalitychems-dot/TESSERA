/** Tessera Next. Older accent names resolve to a Next facet. */

const LEGACY_ACCENT: Record<string, string> = {
  cyan: "glass",
  purple: "return",
  rose: "fracture",
  green: "mineral",
  amber: "flash",
  blue: "glass",
  indigo: "return",
  teal: "stone",
};

export const FONT_COLORS = [
  { label: "Bone", value: "#f3efe6", bg: "#f3efe6" },
  { label: "Glass", value: "#7ef0d4", bg: "#7ef0d4" },
  { label: "Fracture", value: "#ff5c39", bg: "#ff5c39" },
  { label: "Flash", value: "#d7f6ff", bg: "#d7f6ff" },
  { label: "Return", value: "#e4c6ff", bg: "#e4c6ff" },
] as const;

export const ACCENT_COLORS = [
  { label: "Glass", value: "glass", color: "#7ef0d4", hsl: "165 79% 72%" },
  { label: "Fracture", value: "fracture", color: "#ff5c39", hsl: "11 100% 61%" },
  { label: "Flash", value: "flash", color: "#d7f6ff", hsl: "192 100% 92%" },
  { label: "Stone", value: "stone", color: "#1f8f7a", hsl: "168 64% 34%" },
  { label: "Return", value: "return", color: "#e4c6ff", hsl: "276 100% 89%" },
  { label: "Mineral", value: "mineral", color: "#8fd9c4", hsl: "162 48% 70%" },
] as const;

export const PARTICLE_COLORS = [
  "#7ef0d4", "#d7f6ff", "#f3efe6", "#1f8f7a", "#e4c6ff", "#ff5c39",
];

export const STAR_COLORS = [
  "#f3efe6", "#d7f6ff", "#7ef0d4", "#e4c6ff",
];

export function resolveAccent(accentValue?: string) {
  const mapped = accentValue ? LEGACY_ACCENT[accentValue] ?? accentValue : "glass";
  return ACCENT_COLORS.find((item) => item.value === mapped) ?? ACCENT_COLORS[0];
}

export function applyTheme(accentValue?: string) {
  const html = document.documentElement;
  html.classList.remove("light");
  html.classList.add("dark");

  const accent = resolveAccent(accentValue);
  const hslParts = accent.hsl.split(" ");
  const hue = parseInt(hslParts[0], 10);

  const accentVars: Record<string, string> = {
    "--primary": accent.hsl,
    "--primary-foreground": "210 26% 6%",
    "--ring": accent.hsl,
    "--input": `${hue} 14% 18%`,
    "--sidebar-primary": accent.hsl,
    "--sidebar-ring": accent.hsl,
    "--sidebar-accent": `${hue} 18% 14%`,
    "--chart-1": accent.hsl,
    "--accent": `${hue} 20% 18%`,
  };
  for (const [name, value] of Object.entries(accentVars)) html.style.setProperty(name, value);
}

export function handleFontColorChange(currentColor: string, newColor: string): string {
  const next = currentColor === newColor ? "" : newColor;
  if (next) localStorage.setItem("tessera-font-color", next);
  else localStorage.removeItem("tessera-font-color");
  window.dispatchEvent(new Event("tessera-font-color-change"));
  return next;
}

export function handleThemeChange(accent: string) {
  const next = resolveAccent(accent).value;
  localStorage.setItem("tessera-accent", next);
  applyTheme(next);
  window.dispatchEvent(new Event("tessera-theme-change"));
}
