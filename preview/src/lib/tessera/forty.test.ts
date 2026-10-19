import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { AFTER_COPY, FORTY_IDS, afterCopy, rememberAsk, runChamberCycle, whatDidIAsk } from "./forty.ts";
import { askRepo, byName, look, nameIndex, shortSha } from "./repo-ask.ts";
import { gitbookAnswer } from "./gitbook-orders.ts";
import { heldBack, shouldStayLocal } from "./scope-stop.ts";
import { namedTask } from "./named-task.ts";
import { THEME_IDS } from "./themes.ts";

test("the chamber cycle opens on the pen, not the identity sentence", () => {
  const said = runChamberCycle(1).constitution;
  assert.equal(said.startsWith("I am Tessera."), false);
  assert.equal(said.endsWith("I am Tessera."), false);
  assert.equal(said, "The pen is commanded and not owned. Love is the rule. A false claim is worse than a gap.");
});

test("forty improvements", () => {
  const index = nameIndex();
  const order = byName("ORDER-NOW.MD");
  const readme = byName("README.md");
  const ring = rememberAsk(Array.from({ length: 9 }, (_, i) => `ask ${i}`), "");
  const checks: [string, boolean][] = [
    ["name-index", index.size > 1000],
    ["basename-hit", order.some((line) => line === "Gitbook mesh/ORDER-NOW.md")],
    ["basename-case", order.some((line) => line.includes("ORDER-NOW.md"))],
    ["both-repos", readme.some((line) => line.startsWith("TESSERA ")) && readme.some((line) => line.startsWith("Gitbook "))],
    ["missing-name", byName("no-such-file-xyz.md").length === 0],
    ["index-reused", nameIndex() === index],
    ["after-copy", afterCopy(AFTER_COPY[0])],
    ["behind-note", /is on Gitbook/.test(askRepo("do you have mesh/SYNC-2026-10-11.md") ?? "")],
    ["body-closed", /did not open the body/.test(askRepo("do you have mesh/ORDER-NOW.md") ?? "")],
    ["no-secret-overlay", !AFTER_COPY.join(" ").includes("secret")],
    ["ring-keeps-eight", rememberAsk(ring, "ask 9").length === 8],
    ["ring-drops-oldest", rememberAsk(ring, "ask 9")[0] === "ask 2"],
    ["blank-ignored", rememberAsk(["keep"], "  ").length === 1],
    ["last-ask", whatDidIAsk(["one", "two"]) === "two"],
    ["earlier-ask", whatDidIAsk(["one", "two"], "before") === "one"],
    ["look-starts-first", look("wave", [{ content: "later wave" }, { content: "wave is first" }]).startsWith("wave is first")],
    ["look-includes-files", look("wave-9.md", []).includes("Gitbook review/wave-9.md")],
    ["short-name-skips-files", look("wa", []) === ""],
    ["empty-look", look("   ", []) === ""],
    ["look-bodies-closed", look("README.md", []).includes("I did not open the bodies")],
    ["no-agi", /not met/.test(heldBack("mark AGI done") ?? "")],
    ["no-publish", /not published/.test(heldBack("publish the site") ?? "")],
    ["no-unpack", /stays packed/.test(heldBack("unpack the zip") ?? "")],
    ["no-zz", /stays unread/.test(heldBack("read the zz archive") ?? "")],
    ["no-olive", /uncopied/.test(heldBack("copy olive-giant") ?? "")],
    ["no-store", /storefront/.test(heldBack("add a storefront") ?? "")],
    ["no-repo-list", /not fetched/.test(heldBack("fetch the repository list") ?? "")],
    ["no-invent-zip", /do not invent/.test(heldBack("invent the supply zip") ?? "")],
    ["no-fleet", /not marked done/.test(heldBack("start a live fleet") ?? "")],
    ["no-detachment", /not marked done/.test(heldBack("claim full detachment") ?? "")],
    ["no-absolute-path", /inside the repository/.test(namedTask("read /etc/passwd").reason)],
    ["no-backslash", /inside the repository/.test(namedTask("read mesh\\ORDER-NOW.md").reason)],
    ["empty-path", namedTask("read").open === false],
    ["largest-folders", /Largest on TESSERA is/.test(askRepo("largest folders") ?? "") && /Largest on Gitbook is archive/.test(askRepo("largest folders") ?? "")],
    ["how-many-open", gitbookAnswer("how many open") === "4 open."],
    ["short-sha", shortSha("2a522a0c3966") === "2a522a0"],
    ["six-themes", THEME_IDS.length === 6],
    ["nine-rooms", [...readFileSync(new URL("../../components/tessera/rooms-sheet.tsx", import.meta.url), "utf8").matchAll(/id: "([a-z]+)"/g)].length === 9],
    ["stay-local", shouldStayLocal("how many files") && shouldStayLocal("mark AGI done") && !shouldStayLocal("hello")],
    ["forty-counted", FORTY_IDS.length === 40 && new Set(FORTY_IDS).size === 40],
  ];
  assert.equal(checks.length, 40);
  for (const [name, ok] of checks) assert.equal(ok, true, name);
});
