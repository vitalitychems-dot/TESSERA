import assert from "node:assert/strict";
import test from "node:test";
import { lanRoomConfig } from "./lan-mode.ts";
test("LAN mode uses no ICE servers and refuses public signaling", () => {
  assert.deepEqual(lanRoomConfig().iceServers, []);
  assert.equal(lanRoomConfig("http://192.168.1.5:3000/api/rtc").signalUrl, "http://192.168.1.5:3000/api/rtc");
  assert.throws(() => lanRoomConfig("https://signal.example.com"));
});
