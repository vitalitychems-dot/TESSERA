import assert from "node:assert/strict";
import test from "node:test";
import { fetchOwnRepo } from "../src/knowledge/own-repo.mjs";

test("repo metadata is fetched only for vitalitychems-dot", async () => {
  let calls = 0;
  const fetchFn = async (url) => {
    calls += 1;
    assert.equal(url, "https://api.github.com/repos/vitalitychems-dot/TESSERA");
    return {
      ok: true,
      async json() {
        return { full_name: "vitalitychems-dot/TESSERA", description: "studio" };
      },
    };
  };

  const refused = await fetchOwnRepo("octocat/hello", fetchFn);
  assert.deepEqual(refused, { ok: false, reason: "owner refused" });
  assert.equal(calls, 0);

  const ours = await fetchOwnRepo("vitalitychems-dot/TESSERA", fetchFn);
  assert.equal(ours.ok, true);
  assert.equal(ours.fullName, "vitalitychems-dot/TESSERA");
  assert.equal(calls, 1);
});
