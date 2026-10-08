import assert from "node:assert/strict";
import test from "node:test";
import { nextSpongeQuery } from "./sponge.ts";

test("she picks her own next title and skips a captcha ask", () => {
  const next = nextSpongeQuery(["Emerald Tablet"], ["captcha login", "Rick · Emerald Tablet", "Black Madonna Traditions"]);
  assert.equal(next, "Black Madonna Traditions");
});
