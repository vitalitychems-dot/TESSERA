import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildZim, openZim, ZimCompressionError } from "../src/offline/zim.mjs";
import { buildIndex, saveIndex, loadIndex, search, tokenize } from "../src/offline/search.mjs";

const dir = mkdtempSync(join(tmpdir(), "zim-"));
const arts = [
  { ns: "C", url: "Photosynthesis", title: "Photosynthesis", mime: "text/html", body: "<p>Plants convert <b>light</b> into chemical energy.</p>" },
  { ns: "C", url: "Black_hole", title: "Black hole", mime: "text/html", body: "<p>A region of spacetime where gravity prevents light escaping.</p>" },
  { ns: "C", url: "Kiwix", title: "Kiwix", mime: "text/html", body: "<p>Kiwix reads ZIM files for offline Wikipedia.</p>" },
  { ns: "C", url: "logo.png", title: "", mime: "image/png", body: "\x89PNG" },
];
const path = join(dir, "t.zim");
writeFileSync(path, buildZim(arts, [{ ns: "C", url: "BH", title: "BH", target: "Black_hole" }]));

test("reads header, mime list and articles", () => {
  const z = openZim(path);
  assert.equal(z.header.entryCount, 5);
  assert.deepEqual(z.mimes, ["text/html", "image/png"]);
  assert.match(z.getContent("C", "Kiwix").data.toString(), /offline Wikipedia/);
  assert.equal(z.getContent("C", "BH").entry.url, "Black_hole"); // redirect resolved
  assert.equal(z.getContent("C", "Nope"), null);
  assert.equal(z.titleOrder(0).title, "BH");
  z.close();
});

test("rejects non-ZIM and compressed clusters clearly", () => {
  const bad = join(dir, "bad.zim"); writeFileSync(bad, Buffer.alloc(100));
  assert.throws(() => openZim(bad), /not a ZIM/);
  const buf = buildZim(arts); const cpos = Number(buf.readBigUInt64LE(Number(buf.readBigUInt64LE(48))));
  buf[cpos] = 5; const zs = join(dir, "zstd.zim"); writeFileSync(zs, buf);
  const z = openZim(zs);
  assert.throws(() => z.getContent("C", "Kiwix"), ZimCompressionError);
  z.close();
});

test("offline search index: build, persist, query", () => {
  const z = openZim(path);
  const idx = buildIndex(z); z.close();
  const ip = join(dir, "idx.json"); saveIndex(idx, ip);
  const L = loadIndex(ip);
  assert.equal(L.docs.length, 3); // text articles only, no redirect/image
  assert.equal(search(L, "black hole")[0].url, "Black_hole");
  assert.equal(search(L, "offline wikipedia")[0].url, "Kiwix");
  assert.deepEqual(search(L, "light").map((r) => r.url), ["Black_hole", "Photosynthesis"]); // deterministic tie-break
  assert.deepEqual(search(L, "zzzz"), []);
  assert.deepEqual(tokenize("Café ZIM-files"), ["cafe", "zim", "files"]);
  assert.ok(statSync(ip).size < 4096);
});
