import assert from "node:assert/strict";
import test from "node:test";
import { createMonitor, fakeWorker, listenMonitor } from "../src/studio/worker-stream.mjs";

test("fake worker tool events show up on the monitor API", async () => {
  const monitor = createMonitor();
  const { server, url } = await listenMonitor(monitor);
  try {
    fakeWorker(monitor, "t1");
    const response = await fetch(`${url}/events`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.events.map((event) => event.name),
      ["tool.read", "tool.write"],
    );
    assert.equal(body.events[0].type, "worker.event");
    assert.equal(body.events[0].taskId, "t1");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
