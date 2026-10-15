/** Canonical Tessera Next facets; old saved names remain compatible. */
const LEGACY_ACCENT: Record<string, string> = {
  cyan: "glass", blue: "glass", purple: "return", indigo: "return",
  rose: "fracture", green: "mineral", amber: "flash", teal: "stone",
};

export const DEFAULT_ACCENT = "glass";

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
  "#7ef0d4", "#d7f6ff", "#f3efe6", "#1f8f7a", "#e4c6ff", "#8fd9c4",
];

export const STAR_COLORS = [
  "#f3efe6", "#d7f6ff", "#7ef0d4", "#e4c6ff",
];

export function resolveAccent(value?: string) {
  const normalized = value?.trim().toLowerCase() || DEFAULT_ACCENT;
  const mapped = LEGACY_ACCENT[normalized] ?? normalized;
  return ACCENT_COLORS.find(item => item.value === mapped) ?? ACCENT_COLORS[0];
}

export function applyTheme(accentValue?: string) {
  const html = document.documentElement;
  html.classList.remove("light");
  html.classList.add("dark");

  const accent = resolveAccent(accentValue);
  const hslParts = accent.hsl.split(" ");
  const hue = parseInt(hslParts[0]);

  const accentCss = [
    `--primary: ${accent.hsl}`,
    `--primary-foreground: 210 26% 6%`,
    `--ring: ${accent.hsl}`,
    `--input: ${hue} 14% 22%`,
    `--sidebar-primary: ${accent.hsl}`,
    `--sidebar-ring: ${accent.hsl}`,
    `--sidebar-accent: ${hue} 18% 12%`,
    `--chart-1: ${accent.hsl}`,
    `--accent: ${hue} 20% 20%`,
  ].join("; ") + ";";

  let style = document.getElementById("tessera-theme-vars") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "tessera-theme-vars";
    document.head.appendChild(style);
  }

  // Inline properties outrank .dark defaults regardless of stylesheet load order.
  for (const declaration of accentCss.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator !== -1) html.style.setProperty(
      declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim(),
    );
  }
  style.textContent = "";
  html.dataset.theme = "tessera-next";
  html.dataset.accent = accent.value;
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
  try { localStorage.setItem("tessera-accent", next); } catch { /* Storage may be blocked. */ }
  applyTheme(next);
  window.dispatchEvent(new Event("tessera-theme-change"));
}
