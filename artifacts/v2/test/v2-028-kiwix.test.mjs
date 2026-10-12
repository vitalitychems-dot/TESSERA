import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_KIWIX, kiwixSearch } from "../../../preview/src/lib/tessera/kiwix.ts";

test("Kiwix is off by default and a mocked local server returns titles", async () => {
  assert.equal(DEFAULT_KIWIX.enabled, false);
  let called = false;
  const off = await kiwixSearch(DEFAULT_KIWIX, "rust", async () => {
    called = true;
    return new Response("");
  });
  assert.equal(off.used, false);
  assert.equal(called, false);

  const remote = await kiwixSearch({ enabled: true, baseUrl: "https://example.com" }, "rust", async () => {
    called = true;
    return new Response("");
  });
  assert.equal(remote.used, false);
  assert.equal(called, false);

  const local = await kiwixSearch({ enabled: true, baseUrl: "http://127.0.0.1:8080" }, "rust", async (url) => {
    assert.match(String(url), /^http:\/\/127\.0\.0\.1:8080\/search\?pattern=rust/);
    return new Response("<rss><title>Search: rust</title><item><title>Rust (language)</title></item></rss>");
  });
  assert.deepEqual(local, { used: true, titles: ["Rust (language)"] });
});
