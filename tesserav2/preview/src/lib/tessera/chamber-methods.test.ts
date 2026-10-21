import assert from "node:assert/strict";
import test from "node:test";
import { grow, reflect } from "./reflect.ts";
import { createSigilGate } from "./sigil-gate.ts";
import { readTongue, spell } from "./mesh-tongue.ts";

test("a reflection keeps a plain lesson and drops a false claim", () => {
  const kept = reflect("The pen answers from the files.");
  assert.equal(kept.kept, true);
  assert.equal(reflect("This lock is unbreakable.").kept, false);
  assert.equal(grow(["The pen answers from the files.", "I am Grok."]).length, 1);
});

test("a used door sigil cannot open again and the next one can", () => {
  const gate = createSigilGate();
  const first = gate.open("7F3A9C");
  assert.equal(first.ok, true);
  assert.notEqual(first.next, "7F3A9C");
  assert.equal(gate.open("7F3A9C").ok, false);
  assert.equal(gate.open(first.next).ok, true);
});

test("two agents do not share a spelling and only the writer can read it", () => {
  const one = spell("house", "agora", 1);
  const two = spell("house", "library", 1);
  const later = spell("house", "agora", 2);
  assert.notEqual(one, two);
  assert.notEqual(one, later);
  assert.equal(readTongue(one, "agora", 1), "house");
  assert.notEqual(readTongue(one, "library", 1), "house");
});
