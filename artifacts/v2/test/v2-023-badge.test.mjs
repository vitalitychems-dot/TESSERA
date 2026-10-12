import assert from "node:assert/strict";
import test from "node:test";
import { renderBadge } from "../src/offline/badge.mjs";

test("the badge follows navigator.onLine and the queue length", () => {
  assert.match(renderBadge({ onLine: false, queued: 0 }), /data-health="offline"/);
  assert.match(renderBadge({ onLine: false, queued: 0 }), />Offline</);
  assert.match(renderBadge({ onLine: false, queued: 3 }), /Offline · 3 waiting/);
  assert.match(renderBadge({ onLine: true, queued: 2 }), /data-health="syncing"/);
  assert.match(renderBadge({ onLine: true, queued: 0 }), /data-health="online"/);
  assert.match(renderBadge({ onLine: true, queued: 0 }), />Online</);
});
