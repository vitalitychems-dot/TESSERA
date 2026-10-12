import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_KIWIX, isOfflineWikiQuery, kiwixSearch } from "./kiwix.ts";
const fake = (async () => new Response("<rss><title>Search: x</title><item><title>Rust (language)</title></item></rss>")) as typeof fetch;
test("off by default and makes no request", async () => {
  let called = false;
  const r = await kiwixSearch(DEFAULT_KIWIX, "rust", (async () => { called = true; return new Response(""); }) as typeof fetch);
  assert.equal(r.used, false); assert.equal(called, false);
});
test("only local urls", async () => {
  assert.equal((await kiwixSearch({ enabled: true, baseUrl: "https://example.com" }, "x", fake)).used, false);
});
test("mocked local kiwix returns titles", async () => {
  const r = await kiwixSearch({ enabled: true, baseUrl: "http://127.0.0.1:8080" }, "rust", fake);
  assert.deepEqual(r, { used: true, titles: ["Rust (language)"] });
  assert.ok(isOfflineWikiQuery("check the offline wiki"));
});
