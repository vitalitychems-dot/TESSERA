import assert from "node:assert/strict";
import test from "node:test";
import { allowFetch, fetchHeading, isPrivateHost, mayKeepReading } from "./address-guard.ts";

const BLOCKED = [
  "localhost",
  "localhost.",
  "app.local",
  "db.internal",
  "::1",
  "[::1]",
  "127.0.0.1",
  "127.0.0.1.",
  "127.1",
  "127.0.1",
  "0177.0.0.1",
  "2130706433",
  "0x7f000001",
  "0.0.0.0",
  "10.1.2.3",
  "192.168.1.9",
  "172.16.0.1",
  "172.31.255.1",
  "169.254.1.1",
  "fe80::1",
];

test("twenty private address forms are refused and a public name is not", () => {
  assert.equal(BLOCKED.length, 20);
  assert.ok(BLOCKED.every((host) => isPrivateHost(host)));
  assert.equal(isPrivateHost("example.com"), false);
  assert.equal(isPrivateHost("172.15.0.1"), false);
  assert.equal(isPrivateHost("8.8.8.8"), false);
});

test("fetches stop at thirty in an hour and a secret is not kept", () => {
  const stamps = Array.from({ length: 30 }, (_, i) => i);
  assert.equal(allowFetch(30, stamps).ok, false);
  assert.equal(allowFetch(30, stamps.slice(0, 29)).ok, true);
  assert.equal(mayKeepReading("trade crypto now").ok, false);
  assert.equal(mayKeepReading("Plato founded the Academy in Athens and taught there.").ok, true);
  assert.match(fetchHeading("https://example.com", "2026-10-08T20:00:00.000Z", 12), /12 bytes/);
});
