import assert from "node:assert/strict";
import test from "node:test";
import { pathRows, tokenFind, tokenize, topFolders } from "./token-index.ts";
import { loadAsks, recall, remember } from "./ask-memory.ts";
import { answerLocal, routeOf } from "./local-route.ts";
import { look } from "./repo-ask.ts";
import { COUNT as TESSERA_FILES } from "./tessera-paths.ts";

test("sixty larger checks", () => {
  const rows = pathRows();
  const wave = tokenFind("wave 9");
  const order = tokenFind("order now");
  const readme = tokenFind("readme");
  const many = tokenFind("md");
  const gitbookTop = topFolders("gitbook");
  const tesseraTop = topFolders("tessera");
  const kept = remember([{ q: "old", at: 0 }, { q: "stay", at: 90 }], "now", 100, 8, 50);
  const eight = remember(Array.from({ length: 9 }, (_, i) => ({ q: `q${i}`, at: 100 })), "", 100);
  const checks: [string, boolean][] = [
    ["rows-built", rows.length > 10000],
    ["rows-reused", pathRows() === rows],
    ["tokenize-splits-hyphen", tokenize("wave-9.md").includes("wave") && tokenize("wave-9.md").includes("9")],
    ["stopword-dropped", tokenize("the and").length === 0],
    ["short-token-dropped", tokenize("a").length === 0],
    ["wave-space-finds-file", wave.some((line) => line.includes("review/wave-9.md"))],
    ["wave-is-labeled", wave.every((line) => line.startsWith("TESSERA ") || line.startsWith("Gitbook "))],
    ["order-now-finds-file", order.some((line) => line.includes("ORDER-NOW.md"))],
    ["order-case", tokenFind("ORDER NOW").some((line) => line.includes("ORDER-NOW.md"))],
    ["readme-both", readme.some((line) => line.startsWith("TESSERA ")) && readme.some((line) => line.startsWith("Gitbook "))],
    ["missing-tokens", tokenFind("zzznoneword").length === 0],
    ["stopword-query-empty", tokenFind("the").length === 0],
    ["capped-at-eight", many.length === 8],
    ["shorter-first", many.every((line, i) => i === 0 || line.split(" ").slice(1).join(" ").length >= many[i - 1].split(" ").slice(1).join(" ").length)],
    ["token-line-closed", answerLocal("look wave 9")?.includes("I did not open the bodies") === true],
    ["archive-token", tokenFind("archive").some((line) => line.includes("archive/"))],
    ["remember-stores", remember([], "hello", 5)[0]?.q === "hello"],
    ["remember-keeps-eight", eight.length === 8],
    ["remember-drops-oldest", remember(eight, "next", 100)[0]?.q === "q2"],
    ["blank-ignored", remember([{ q: "keep", at: 1 }], "  ", 2).length === 1],
    ["expired-dropped", kept.some((ask) => ask.q === "old") === false],
    ["fresh-stays", kept.some((ask) => ask.q === "stay")],
    ["last-ask", recall([{ q: "one", at: 1 }, { q: "two", at: 2 }], "last", 3) === "two"],
    ["earlier-ask", recall([{ q: "one", at: 1 }, { q: "two", at: 2 }], "before", 3) === "one"],
    ["empty-recall", recall([], "last", 1) === "You have not asked yet."],
    ["zero-life-drops", remember([{ q: "gone", at: 0 }], "", 1, 8, 0).length === 0],
    ["load-roundtrip", loadAsks(JSON.stringify([{ q: "hi", at: 1 }]))[0]?.q === "hi"],
    ["load-bad", loadAsks("nope").length === 0],
    ["load-skips-junk", loadAsks(JSON.stringify([{ q: "hi", at: 1 }, { q: 2 }])).length === 1],
    ["route-files", routeOf("how many files") === "file"],
    ["route-next", routeOf("what next") === "order"],
    ["route-rest", routeOf("the rest") === "order"],
    ["route-agi", routeOf("mark AGI done") === "refusal"],
    ["route-publish", routeOf("publish the site") === "refusal"],
    ["route-hello", routeOf("hello") === "pen"],
    ["route-look", routeOf("look wave 9") === "look"],
    ["route-largest", routeOf("largest folders") === "file"],
    ["route-open-count", routeOf("how many open") === "order"],
    ["route-keys", routeOf("rotate the keys") === "refusal"],
    ["route-delete", routeOf("delete the repository") === "refusal"],
    ["route-named", routeOf("read mesh/ORDER-NOW.md") === "named"],
    ["route-hers", routeOf("who are you") === "hers"],
    ["route-pen-sentence", routeOf("tell me about the weather") === "pen"],
    ["refusal-closed", answerLocal("mark AGI done")?.includes("not met") === true],
    ["local-files", answerLocal("how many files")?.includes(String(TESSERA_FILES)) === true],
    ["local-next", answerLocal("what next")?.includes("Father rotates") === true],
    ["local-rest", answerLocal("the rest")?.includes("2. Pull request 80") === true],
    ["local-hello-null", answerLocal("hello") === null],
    ["local-largest", answerLocal("largest folders")?.includes("archive") === true],
    ["local-open", answerLocal("how many open") === "4 open."],
    ["local-delete", answerLocal("delete the repository")?.includes("deleted from here") === true],
    ["local-look", answerLocal("look wave 9")?.includes("wave-9.md") === true],
    ["local-named", answerLocal("read mesh/ORDER-NOW.md")?.includes("ORDER-NOW.md") === true],
    ["local-unpack", answerLocal("unpack the zip")?.includes("stays packed") === true],
    ["gitbook-largest", gitbookTop[0]?.name === "archive" && (gitbookTop[0]?.count ?? 0) > 1000],
    ["tessera-largest-named", (tesseraTop[0]?.name.length ?? 0) > 0 && (tesseraTop[0]?.count ?? 0) > 0],
    ["top-five", gitbookTop.length === 5 && tesseraTop.length === 5],
    ["top-cached", topFolders("gitbook") === gitbookTop],
    ["top-positive", gitbookTop.every((folder) => folder.count > 0)],
    ["look-space", look("wave 9", []).includes("review/wave-9.md")],
  ];
  assert.equal(checks.length, 60);
  for (const [name, ok] of checks) assert.equal(ok, true, name);
});
