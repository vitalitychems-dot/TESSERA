import test from "node:test";
import assert from "node:assert/strict";
import { parseRepositories, inspectRepository, recall } from "./repository-context.mjs";

test("deduplicates URLs while retaining categories and mention counts", () => {
  const result = parseRepositories("- [ ] Memory\nhttps://github.com/owner/repo.git\n- [ ] Research\nhttps://github.com/OWNER/repo");
  assert.equal(result.length, 1);
  assert.equal(result[0].mentions, 2);
  assert.deepEqual(result[0].categories, ["Memory", "Research"]);
  assert.equal(result[0].installed, false);
});

test("rejects foreign hosts, credentials, query strings and malformed paths", () => {
  for (const url of ["https://localhost/a/b", "https://github.com.evil/a/b",
    "https://user:pass@github.com/a/b", "http://github.com/a/b",
    "https://github.com/a/b?x=1", "https://github.com/a/b/tree/main"]) {
    assert.throws(() => parseRepositories(url));
  }
});

test("metadata is not execution or license approval", async () => {
  const [entry] = parseRepositories("https://github.com/a/b");
  const result = await inspectRepository(entry, async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/a/b");
    assert.equal(options.redirect, "manual");
    return new Response(JSON.stringify({ full_name: "a/b", description: "memory recall", license: { spdx_id: "MIT" } }));
  });
  assert.equal(result.status, "metadata-read");
  assert.equal(result.executed, false);
  assert.equal(result.licenseReviewed, false);
  assert.equal(result.sourceCodeRead, false);
});

test("failed reads and identity mismatches stay explicit", async () => {
  const [entry] = parseRepositories("https://github.com/a/b");
  assert.equal((await inspectRepository(entry, async () => new Response("", { status: 404 }))).status, "http-404");
  assert.equal((await inspectRepository(entry, async () => new Response('{"full_name":"a/c"}'))).status, "unavailable");
});

test("offline recall ranks references without executing them", () => {
  const repositories = parseRepositories("- [ ] Memory\nhttps://github.com/a/memory\n- [ ] Video\nhttps://github.com/a/video");
  assert.equal(recall({ repositories }, "memory")[0].repository, "a/memory");
  assert.deepEqual(recall({ repositories }, "unmatched"), []);
});
