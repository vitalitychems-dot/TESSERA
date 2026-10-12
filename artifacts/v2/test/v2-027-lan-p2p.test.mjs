import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lanRoomConfig } from "../../../preview/src/lib/multiplayer/lan-mode.ts";

test("LAN mode uses an empty ICE list and the two-tab note stays on localhost", () => {
  assert.deepEqual(lanRoomConfig().iceServers, []);
  assert.equal(lanRoomConfig("http://127.0.0.1:3000/api/rtc").signalUrl, "http://127.0.0.1:3000/api/rtc");
  assert.throws(() => lanRoomConfig("https://signal.example.com"));
  const note = readFileSync(new URL("../../../docs/v2/offline/LAN-P2P.md", import.meta.url), "utf8");
  assert.match(note, /two browser tabs/i);
  assert.match(note, /127\.0\.0\.1/);
  assert.match(note, /empty ICE/i);
});
