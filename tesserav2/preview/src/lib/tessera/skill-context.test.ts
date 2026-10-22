import assert from "node:assert/strict";
import test from "node:test";
import { answerInContext, followAsk } from "./skill-context.ts";

test("a follow-up uses the last skill and a new sentence does not", () => {
  const sorted = answerInContext("sort zeta, alpha", "again");
  assert.equal(sorted?.skill, "sort");
  assert.match(sorted?.answer ?? "", /alpha, zeta/);
  assert.match(sorted?.answer ?? "", /Last ask: sort zeta, alpha/);

  const added = answerInContext("sort zeta, alpha", "and beta");
  assert.equal(added?.ask, "sort zeta, alpha, beta");
  assert.match(added?.answer ?? "", /alpha, beta, zeta/);

  const bare = answerInContext("sort zeta, alpha", "sort");
  assert.equal(bare?.ask, "sort zeta, alpha");

  const quoted = answerInContext("quote Our Lady of Fátima is a title. The rest stays.", "again");
  assert.equal(quoted?.skill, "quote");
  assert.match(quoted?.answer ?? "", /Our Lady of Fátima is a title\./);

  assert.equal(answerInContext("", "again")?.answer, "There is no last skill.");
  assert.equal(answerInContext("", "and beta")?.answer, "There is no last skill.");
  assert.equal(answerInContext("help me", "and beta")?.answer, "There is no last skill.");
  assert.equal(answerInContext("sort zeta, alpha", "help"), null);
  assert.equal(followAsk("sort zeta, alpha", "where is the wallet"), "where is the wallet");
});
