import assert from "node:assert/strict";
import test from "node:test";
import { importCookies, searchAllowlist } from "../src/adapters/allowlist.mjs";

const FIXTURE = {
  hits: [{ title: "Show HN: a local studio", url: "https://news.ycombinator.com/item?id=1" }],
};

test("Hacker News search uses a fixture, and login or cookies never run", async () => {
  assert.throws(() => importCookies(), /cookie import is disabled/);

  let calls = 0;
  const fetchFn = async (url, options) => {
    calls += 1;
    assert.equal(url, "https://hn.algolia.com/api/v1/search?query=studio");
    assert.equal(options.headers.cookie, undefined);
    return { async json() { return FIXTURE; } };
  };

  const login = await searchAllowlist("https://hn.algolia.com/login", fetchFn);
  assert.deepEqual(login, { ok: false, reason: "login refused" });
  const other = await searchAllowlist("https://example.com/search?q=studio", fetchFn);
  assert.deepEqual(other, { ok: false, reason: "host refused" });
  assert.equal(calls, 0);

  const found = await searchAllowlist("https://hn.algolia.com/api/v1/search?query=studio", fetchFn);
  assert.equal(found.ok, true);
  assert.equal(found.hits[0].title, "Show HN: a local studio");
  assert.equal(calls, 1);
});
