import assert from "node:assert/strict";
import test from "node:test";
import { sitCouncil } from "./council.ts";

test("ten seats agree only when every one carries her mark", () => {
  const self = "be9f4ef632149361";
  const seats = Array.from({ length: 10 }, (_, index) => ({
    name: `seat-${index + 1}`,
    mark: self,
    line: "build the next small step",
  }));
  assert.equal(sitCouncil(seats, self), "agreed: build the next small step");
  const stranger = seats.map((seat, index) => (index === 3 ? { ...seat, mark: "other" } : seat));
  assert.equal(sitCouncil(stranger, self), "a seat did not carry her mark");
  const split = seats.map((seat, index) => (index === 9 ? { ...seat, line: "other" } : seat));
  assert.equal(sitCouncil(split, self), "the seats do not agree");
});
