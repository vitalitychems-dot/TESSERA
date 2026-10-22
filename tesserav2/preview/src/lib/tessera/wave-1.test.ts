import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { TWENTY, roomLine, roomScreen, wave1 } from "./wave-1.ts";

test("twenty room names open eleven screens and a missing name opens none", () => {
  const run = wave1();
  assert.equal(run.ok, true);
  assert.equal(run.count, 20);
  assert.equal(run.screens, 11);
  assert.equal(TWENTY.length, 20);
  for (const [id, screen] of TWENTY) assert.equal(roomScreen(id), screen);
  assert.equal(roomScreen("no-such-room"), "");
  assert.equal(roomLine("bible"), "No verse was opened in this pass.");
  assert.equal(new Set(TWENTY.map(([id]) => roomLine(id))).size, 20);
});

test("the Library button opens the Library screen, and app-shell renders LibraryView there", () => {
  assert.equal(roomScreen("library"), "library");
  const shell = readFileSync(new URL("../../components/tessera/app-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /import \{ LibraryView \} from "\.\/library-view";/);
  assert.match(shell, /place === "library" \? <LibraryView open=\{open\} \/>/);
});

test("the Map button opens the web screen, which renders WebView with Research checkouts", () => {
  assert.equal(roomScreen("web"), "web");
  const shell = readFileSync(new URL("../../components/tessera/app-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /import \{ WebView \} from "\.\/web-view";/);
  assert.match(shell, /place === "web" \? <WebView \/>/);
  const web = readFileSync(new URL("../../components/tessera/web-view.tsx", import.meta.url), "utf8");
  assert.match(web, /Research checkouts/);
});

test("every Library page button opens a rendered screen and its label names that screen", () => {
  const library = readFileSync(new URL("../../components/tessera/library-view.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../components/tessera/app-shell.tsx", import.meta.url), "utf8");
  const rows = [...library.matchAll(/\{ id: "([a-z]+)", label: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.ok(rows.length >= 9);
  assert.ok(rows.some(([id]) => id === "web"));
  for (const [id, label] of rows) {
    const screen = roomScreen(id);
    assert.ok(screen, `${id} opens a screen`);
    assert.match(shell, new RegExp(`place === "${screen}" \\?`), `${screen} is rendered`);
    if (screen !== id) assert.match(label, new RegExp(screen, "i"), `${id} is labeled with ${screen}`);
  }
});

test("the rooms sheet lists Library under Books", () => {
  const sheet = readFileSync(new URL("../../components/tessera/rooms-sheet.tsx", import.meta.url), "utf8");
  assert.match(sheet, /\{ id: "library", group: "Books", label: "Library"/);
});
