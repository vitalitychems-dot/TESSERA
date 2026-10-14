import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "artifacts", "tessera");
const themePath = join(webRoot, "src", "lib", "theme-constants.ts");

async function importThemeModule() {
  const source = readFileSync(themePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: themePath,
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

function withBrowserGlobals(run, { blockStorage = false } = {}) {
  const original = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    window: globalThis.window,
  };
  const values = new Map();
  const variables = new Map();
  const classes = new Set(["light"]);
  const events = [];
  const storage = {
    getItem(key) {
      if (blockStorage) throw new Error("storage blocked");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (blockStorage) throw new Error("storage blocked");
      values.set(key, String(value));
    },
    removeItem(key) {
      if (blockStorage) throw new Error("storage blocked");
      values.delete(key);
    },
  };
  globalThis.document = {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
      style: { setProperty: (name, value) => variables.set(name, value) },
      dataset: {},
    },
  };
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
  return Promise.resolve()
    .then(() => run({ values, variables, classes, events, storage }))
    .finally(() => {
      if (original.document === undefined) delete globalThis.document;
      else globalThis.document = original.document;
      if (original.localStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = original.localStorage;
      if (original.window === undefined) delete globalThis.window;
      else globalThis.window = original.window;
    });
}

test("Tessera Next accent migration and live token application are deterministic", async () => {
  const theme = await importThemeModule();
  assert.equal(theme.resolveAccent(" GLASS ").value, "glass");
  assert.equal(theme.resolveAccent("purple").value, "return");
  assert.equal(theme.resolveAccent("unknown").value, "glass");
  assert.deepEqual(theme.ACCENT_COLORS.map((accent) => accent.value), [
    "glass", "fracture", "flash", "stone", "return", "mineral",
  ]);

  await withBrowserGlobals(async ({ classes, variables }) => {
    theme.applyTheme("rose");
    assert.deepEqual([...classes].sort(), ["dark"]);
    assert.equal(document.documentElement.dataset.theme, "tessera-next");
    assert.equal(document.documentElement.dataset.accent, "fracture");
    assert.equal(variables.get("--primary"), "11 100% 61%");
    assert.equal(variables.get("--ring"), "11 100% 61%");
  });
});

test("theme and font-color controls persist compatible preferences and dispatch events", async () => {
  const theme = await importThemeModule();
  await withBrowserGlobals(async ({ values, events }) => {
    theme.handleThemeChange("teal");
    assert.equal(values.get("tessera-accent"), "stone");
    assert.equal(document.documentElement.dataset.accent, "stone");
    assert.deepEqual(events, ["tessera-theme-change"]);

    assert.equal(theme.handleFontColorChange("#f3efe6", "#7ef0d4"), "#7ef0d4");
    assert.equal(values.get("tessera-font-color"), "#7ef0d4");
    assert.equal(theme.handleFontColorChange("#7ef0d4", "#7ef0d4"), "");
    assert.equal(values.has("tessera-font-color"), false);
    assert.deepEqual(events, ["tessera-theme-change", "tessera-font-color-change", "tessera-font-color-change"]);
  });
});

test("blocked browser storage does not prevent visual theme application", async () => {
  const theme = await importThemeModule();
  await withBrowserGlobals(async ({ variables, events }) => {
    theme.handleThemeChange("mineral");
    assert.equal(document.documentElement.dataset.accent, "mineral");
    assert.equal(variables.get("--primary"), "162 48% 70%");
    assert.deepEqual(events, ["tessera-theme-change"]);
  }, { blockStorage: true });
});

test("production first paint and fonts stay local", () => {
  const html = readFileSync(join(webRoot, "index.html"), "utf8");
  const css = readFileSync(join(webRoot, "src", "index.css"), "utf8");
  const themeCss = readFileSync(join(webRoot, "src", "styles", "tessera-next.css"), "utf8");
  const content = `${html}\n${css}\n${themeCss}`;

  assert.doesNotMatch(content, /fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\/.*font/i);
  assert.match(html, /color-scheme:\s*dark/);
  assert.match(html, /#070b10/);
  assert.match(html, /#f3efe6/);
  assert.match(css, /@import "\.\/styles\/tessera-next\.css"/);
  assert.match(themeCss, /prefers-reduced-motion/);
  assert.match(themeCss, /\.tessera-brand-mark/);
  for (const file of ["OFL.txt", "fragment-mono.woff2", "syne-500.woff2", "syne-700.woff2"]) {
    assert.ok(existsSync(join(webRoot, "public", "fonts", file)), file);
  }
});
