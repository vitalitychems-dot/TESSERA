/**
 * Worker tool events land on a monitor the API can read.
 */
import { createServer } from "node:http";
import { checkMessage } from "./protocol.mjs";
import { reviewRequest } from "../hyb011-denylist.mjs";

export function createMonitor() {
  const events = [];
  return {
    emit(event) {
      const row = {
        type: "worker.event",
        taskId: event.taskId,
        name: event.name,
        detail: event.detail ?? "",
      };
      const errors = checkMessage(row);
      if (errors.length) throw new Error(errors.join("; "));
      events.push(row);
      return row;
    },
    list() {
      return events.map((event) => ({ ...event }));
    },
  };
}

export function fakeWorker(monitor, taskId = "t1") {
  monitor.emit({ taskId, name: "tool.read", detail: "docs/v2/README.md" });
  monitor.emit({ taskId, name: "tool.write", detail: "studio note" });
  return monitor.list();
}

export function listenMonitor(monitor = createMonitor()) {
  const server = createServer((req, res) => {
    const gate = reviewRequest({ url: req.url ?? "/", method: req.method });
    if (!gate.allowed) {
      res.writeHead(gate.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: gate.reason, match: gate.match }));
      return;
    }
    if (req.method === "GET" && req.url === "/events") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ events: monitor.list() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}
