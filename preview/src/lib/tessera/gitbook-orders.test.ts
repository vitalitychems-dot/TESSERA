import assert from "node:assert/strict";
import test from "node:test";
import { lookupCatalog } from "./memory-web.ts";
import { combinedUse } from "./cycles.ts";
import { gitbookAnswer, herOrders } from "./gitbook-orders.ts";

test("payments stay with the store and her next work is the Gitbook list", () => {
  assert.equal(lookupCatalog("stripe/stripe-node")?.home, "vitality");
  assert.equal(combinedUse("stripe/stripe-node"), "Store. Not her mind.");
  const orders = herOrders();
  assert.equal(orders.length, 6);
  assert.match(gitbookAnswer("what should we build"), /Do not invent/);
  assert.equal(/stripe|seo|checkout/i.test(orders.join(" ")), false);
});
