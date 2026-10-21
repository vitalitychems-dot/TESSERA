import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

interface BroadcastEvent {
  type: string;
  channel: string;
  data: any;
  timestamp: number;
}

const clients = new Set<WebSocket>();
let wss: WebSocketServer | null = null;
const eventBuffer: BroadcastEvent[] = [];
const MAX_BUFFER = 500;
const channelSubscribers = new Map<string, Set<WebSocket>>();
const ALLOWED_CHANNELS = new Set(["activity", "conference", "health", "agents", "economy", "consciousness"]);
let initialized = false;

export function initBroadcastSystem(server: Server) {
  if (initialized) return;
  initialized = true;

  wss = new WebSocketServer({ server, path: "/ws/broadcast" });

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe" && msg.channel && ALLOWED_CHANNELS.has(msg.channel)) {
          if (!channelSubscribers.has(msg.channel)) {
            channelSubscribers.set(msg.channel, new Set());
          }
          channelSubscribers.get(msg.channel)!.add(ws);
        }
        if (msg.type === "unsubscribe" && msg.channel) {
          channelSubscribers.get(msg.channel)?.delete(ws);
        }
      } catch (err: any) {
        console.log("[WSBroadcast] Invalid message from client:", err.message);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      for (const [channel, subs] of channelSubscribers) {
        subs.delete(ws);
        if (subs.size === 0) channelSubscribers.delete(channel);
      }
    });

    ws.send(JSON.stringify({
      type: "connected",
      channels: Array.from(ALLOWED_CHANNELS),
      timestamp: Date.now(),
    }));
  });

  console.log("[WSBroadcast] Real-time broadcast system initialized on /ws/broadcast");
}

export function broadcast(channel: string, type: string, data: any) {
  const event: BroadcastEvent = { type, channel, data, timestamp: Date.now() };

  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER) eventBuffer.shift();

  const payload = JSON.stringify(event);

  const subs = channelSubscribers.get(channel);
  if (subs && subs.size > 0) {
    subs.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  } else {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}

export function getRecentEvents(channel?: string, limit = 50): BroadcastEvent[] {
  const filtered = channel
    ? eventBuffer.filter((e) => e.channel === channel)
    : eventBuffer;
  return filtered.slice(-limit);
}

export function getConnectionCount(): number {
  return clients.size;
}

export function getChannelStats() {
  const stats: Record<string, number> = {};
  channelSubscribers.forEach((subs, channel) => {
    stats[channel] = subs.size;
  });
  return { totalClients: clients.size, channels: stats, bufferSize: eventBuffer.length };
}
