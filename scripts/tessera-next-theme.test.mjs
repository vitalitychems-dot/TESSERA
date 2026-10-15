import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../artifacts/tessera/src/lib/theme-constants.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const theme = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("all saved legacy accents resolve to the landed Next facets", () => {
  const aliases = { cyan: "glass", blue: "glass", purple: "return", indigo: "return",
    rose: "fracture", green: "mineral", amber: "flash", teal: "stone" };
  for (const [legacy, facet] of Object.entries(aliases)) assert.equal(theme.resolveAccent(legacy).value, facet);
  assert.equal(theme.resolveAccent("unrecognized").value, "glass");
  assert.equal(theme.resolveAccent().color, "#7ef0d4");
});

test("chosen accent survives dark mode through inline properties", () => {
  const properties = new Map();
  const root = { classList: { add() {}, remove() {} },
    style: { setProperty(key, value) { properties.set(key, value); } }, dataset: {} };
  globalThis.document = { documentElement: root, getElementById() { return { textContent: "" }; } };
  for (const facet of theme.ACCENT_COLORS) {
    theme.applyTheme(facet.value);
    assert.equal(properties.get("--primary"), facet.hsl);
    assert.equal(root.dataset.accent, facet.value);
    assert.equal(root.dataset.theme, "tessera-next");
  }
  delete globalThis.document;
});

test("first paint and fonts do not depend on Google Fonts", () => {
  const html = readFileSync(new URL("../artifacts/tessera/index.html", import.meta.url), "utf8");
  const entryCss = readFileSync(new URL("../artifacts/tessera/src/index.css", import.meta.url), "utf8");
  const css = readFileSync(new URL("../artifacts/tessera/src/styles/tessera-next.css", import.meta.url), "utf8");
  function sourceTree(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = `${dir}/${entry.name}`;
      return entry.isDirectory() ? sourceTree(path) : /\.(?:ts|tsx|css)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
    }).join("\n");
  }
  const appSources = sourceTree(new URL("../artifacts/tessera/src", import.meta.url).pathname);
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.google\.com/.test(`${html}\n${css}\n${appSources}`));
  assert.match(html, /<style>[\s\S]*#070b10[\s\S]*#f3efe6/);
  assert.match(entryCss, /@import "\.\/styles\/tessera-next\.css"/);
  assert.match(css, /font-display: swap/);
  assert.match(css, /grid-template-columns: repeat\(2, 1fr\)/);
  for (const file of ["Syne.ttf", "FragmentMono-Regular.ttf", "Syne-OFL.txt", "FragmentMono-OFL.txt"]) {
    assert.ok(existsSync(new URL(`../artifacts/tessera/public/fonts/${file}`, import.meta.url)), file);
  }
});

test("legacy UI utility families inherit the Tessera Next palette", () => {
  const css = readFileSync(new URL("../artifacts/tessera/src/styles/tessera-next.css", import.meta.url), "utf8");
  const aliases = [
    ["cyan", "glass"], ["teal", "glass"], ["emerald", "mineral"], ["green", "mineral"],
    ["blue", "flash"], ["sky", "flash"], ["violet", "return"], ["purple", "return"],
    ["indigo", "return"], ["pink", "return"], ["fuchsia", "return"],
    ["amber", "fracture"], ["yellow", "fracture"], ["orange", "fracture"],
    ["red", "fracture"], ["rose", "fracture"], ["slate", "neutral"],
    ["gray", "neutral"], ["zinc", "neutral"], ["neutral", "neutral"],
  ];
  for (const [legacy, facet] of aliases) {
    assert.match(css, new RegExp(`--color-${legacy}-400: var\\(--next-${facet}-`), `${legacy} utilities map to ${facet}`);
  }
  for (const color of ["#070b10", "#f3efe6", "#7ef0d4", "#ff5c39", "#d7f6ff", "#1f8f7a", "#e4c6ff"]) {
    assert.ok(css.includes(color), `missing Tessera Next color ${color}`);
  }
  assert.match(css, /--next-fracture-400:\s*#ff5c39/);
  assert.match(css, /--next-glass-400:\s*#7ef0d4/);
});
