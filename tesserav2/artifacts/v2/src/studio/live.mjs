/**
 * Studio messages in the V2-013 websocket shapes.
 * worker.event rows come from the V2-017 monitor.
 */
import { createHash } from "node:crypto";
import { checkMessage } from "./protocol.mjs";

export function liveMessages(state, events = []) {
  const messages = [];
  for (const task of state.tasks ?? []) {
    messages.push({
      type: "task.upsert",
      id: task.id,
      title: task.title,
      status: task.status,
    });
  }
  for (const event of events) {
    messages.push({
      type: "worker.event",
      taskId: event.taskId,
      name: event.name,
      detail: event.detail ?? "",
    });
  }
  for (const message of messages) {
    const errors = checkMessage(message);
    if (errors.length) throw new Error(errors.join("; "));
  }
  return messages;
}

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function acceptWebSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return false;
  }
  const accept = createHash("sha1").update(String(key) + WS_GUID).digest("base64");
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  return true;
}

export function textFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}
