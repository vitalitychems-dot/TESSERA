import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "artifacts", "tessera");
const sourceRoot = join(webRoot, "src");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

test("production shell uses one fixed theme and preserves dark utility styles", () => {
  const html = read("index.html");
  const main = read("src/main.tsx");
  const css = read("src/index.css");
  const shell = read("src/styles/workspace-shell.css");

  assert.match(html, /class="dark"/);
  assert.match(html, /color-scheme:\s*dark/);
  assert.match(html, /font-family:\s*system-ui/);
  assert.match(main, /classList\.add\("dark"\)/);
  assert.doesNotMatch(main, /applyTheme|tessera-accent/);
  assert.match(css, /@import "\.\/styles\/workspace-shell\.css"/);
  assert.equal((css.match(/--background:\s*210 26% 4%/g) ?? []).length, 1);
  assert.doesNotMatch(css, /tessera-next\.css|@font-face|Syne|Fragment Mono/);
  assert.match(shell, /prefers-reduced-motion/);
  assert.match(shell, /\.tessera-sidebar-shell/);
  assert.match(shell, /\.tessera-gate-frame/);
  assert.doesNotMatch(shell, /backdrop-filter|radial-gradient|repeating-linear-gradient/);
});

test("theme controls and global decorative animation are retired, not mounted", () => {
  const app = read("src/App.tsx");
  const sidebar = read("src/components/Sidebar.tsx");
  const chatArea = read("src/components/ChatArea.tsx");
  const toolbar = read("src/components/chat/ChatInputToolbar.tsx");

  assert.doesNotMatch(app, /HyperdimensionalBackground/);
  assert.match(app, /<MobileNav\s*\/>/);
  assert.match(app, /<AppRouter\s*\/>/);
  assert.match(app, /<TesseractKeyGate>[\s\S]*<AppRouter\s*\/>[\s\S]*<\/TesseractKeyGate>/);
  assert.doesNotMatch(sidebar, /applyTheme|tessera-accent|FONT_COLORS|ACCENT_COLORS/);
  assert.doesNotMatch(chatArea, /tessera-font-color|themeOpen|userFontColor|ChatFontColorPicker/);
  assert.doesNotMatch(toolbar, /ChatFontColorPicker|onFontColor|localFontColor|themeOpen/);
  for (const retired of [
    "src/lib/theme-constants.ts",
    "src/styles/tessera-next.css",
    "src/components/chat/ChatFontColorPicker.tsx",
    "src/components/HyperdimensionalBackground.tsx",
    "src/components/ToroidalBackground.tsx",
    "src/components/UniverseBackground.tsx",
    "src/lib/brand-palette.ts",
  ]) {
    assert.equal(existsSync(join(sourceRoot, retired.replace(/^src\//, ""))), false, retired);
  }
});

test("ordinary chat defers the Three.js renderer until a 3D object is present", () => {
  const messageItem = read("src/components/chat/ChatMessageItem.tsx");
  const parser = read("src/components/chat/Chat3DParser.ts");
  const renderer = read("src/components/chat/ChatObject3D.tsx");

  assert.match(messageItem, /from "\.\/Chat3DParser"/);
  assert.match(messageItem, /lazy\(\(\)\s*=>\s*import\("\.\/ChatObject3D"\)/);
  assert.doesNotMatch(messageItem, /from "\.\/ChatObject3D"/);
  assert.match(messageItem, /<Suspense key=\{oi\}/);
  assert.match(parser, /export function parse3DObjectBlocks/);
  assert.match(parser, /export function inferObjectSpec/);
  assert.match(renderer, /@react-three\/fiber/);
});

test("new shell retains browser accessibility and a local-only first paint", () => {
  const html = read("index.html");
  const css = read("src/index.css");
  const shell = read("src/styles/workspace-shell.css");
  const objectLabels = read("src/components/chat/ChatObject3D.tsx");
  const content = `${html}\n${css}\n${shell}\n${objectLabels}`;

  assert.doesNotMatch(content, /fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\/.*font/i);
  assert.match(objectLabels, /fonts\/SpaceMono\.woff2/);
  assert.match(shell, /:focus-visible/);
  assert.match(shell, /prefers-reduced-motion/);
  assert.ok(!existsSync(join(webRoot, "src", "styles", "tessera-next.css")));
});
