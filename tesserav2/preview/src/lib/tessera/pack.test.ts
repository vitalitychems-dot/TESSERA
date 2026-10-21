import assert from "node:assert/strict";
import test from "node:test";
import { packLine, packWords, recommendRepo, splitBytes, unpackWords } from "./pack.ts";

test("a note splits, packs, and comes back, and a held repo is not recommended", () => {
  const text = "the house keeps the house on the mesh. the mesh keeps the file.";
  const parts = splitBytes(text, 40);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => new TextEncoder().encode(part).length <= 40));
  assert.equal(parts.join(""), text);
  const packed = packWords(text);
  assert.ok(packed.after < packed.before);
  assert.equal(unpackWords(packed.packed), text);
  assert.match(packLine(text), /Pixels were not used/);
  const said = recommendRepo("help with diffusion", [
    { name: "binance/binance-connector-node", home: "held", note: "Not imported." },
    { name: "AUTOMATIC1111/stable-diffusion-webui", home: "card", note: "Not cloned." },
  ]);
  assert.match(said, /stable-diffusion-webui/);
  assert.match(said, /not run/i);
});
