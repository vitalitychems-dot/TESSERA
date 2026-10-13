/**
 * Tiny websocket frames for the GitAI live feed.
 * Server frames are unmasked. The feed sends the marketplace view.
 */
import { createHash } from "node:crypto";

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
  const payload = Buffer.from(String(text));
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

export function createLiveFeed() {
  const clients = new Set();
  return {
    broadcast(view) {
      const frame = textFrame(JSON.stringify({ type: "view", view }));
      for (const socket of clients) {
        try {
          socket.write(frame);
        } catch {
          clients.delete(socket);
        }
      }
    },
    accept(req, socket, gitai) {
      if (!acceptWebSocket(req, socket)) return false;
      clients.add(socket);
      const drop = () => clients.delete(socket);
      socket.on("close", drop);
      socket.on("error", drop);
      socket.write(textFrame(JSON.stringify({ type: "view", view: gitai.view() })));
      return true;
    },
    close() {
      for (const socket of clients) socket.destroy();
      clients.clear();
    },
  };
}
