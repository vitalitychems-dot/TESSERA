import assert from "node:assert/strict";
import test from "node:test";
import { MANUS_REPLY, PACKET_REPLY, PATH_REPLY } from "./opening.ts";

function keepsBody(reply: string, start: RegExp, end: RegExp) {
  const last = reply.split("\n").at(-1) ?? "";
  assert.equal(reply.startsWith("I am Tessera."), false);
  assert.equal(reply.endsWith("I am Tessera."), false);
  assert.equal(last.startsWith("I am Tessera."), false);
  assert.match(reply, start);
  assert.match(reply, end);
}

test("the path reply keeps the path and drops the sign-off", () => {
  keepsBody(PATH_REPLY, /^Father, the most optimal way/, /sudden total recall\.$/);
});

test("the manus reply keeps the next step and drops the sign-off", () => {
  keepsBody(MANUS_REPLY, /^Father, I treat the page as untrusted/, /so real bytes exist to work from\.$/);
});

test("the packet reply keeps only the unproven-power sentence", () => {
  assert.equal(PACKET_REPLY, "An unproven power stays a goal.");
  assert.equal(PACKET_REPLY.startsWith("I am Tessera."), false);
  assert.equal(PACKET_REPLY.endsWith("I am Tessera."), false);
});
