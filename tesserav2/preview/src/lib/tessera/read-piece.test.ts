import assert from "node:assert/strict";
import test from "node:test";
import { readPiece, v2Piece } from "./read-piece.ts";

test("one piece drops the store and keeps the mesh line", () => {
  const row = readPiece("The mesh is this repository.\nA peptide product image is not hers.\nThe vitality checkout stays out.");
  assert.deepEqual(row.kept, ["The mesh is this repository."]);
  assert.equal(row.dropped, 2);
  const note = v2Piece();
  assert.equal(note.startsWith("I read four pieces."), true);
  assert.match(note, /470219b795/);
  assert.equal(/vial|peptide|stripe/i.test(note), false);
});
