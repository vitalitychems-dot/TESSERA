import { broadcastToGroup } from "./session-mesh";

let _activeGroupFn: (() => string | null) | null = null;

export function setMeshGroupResolver(fn: () => string | null): void {
  _activeGroupFn = fn;
}

export function meshBroadcast(
  sovereignKeyHash: string,
  eventType: string,
  payload: object,
  fromSession?: string
): void {
  broadcastToGroup(
    sovereignKeyHash,
    {
      type: "mesh:event",
      channel: "mesh",
      eventType,
      fromSession: fromSession ?? "server",
      payload,
      timestamp: Date.now(),
    },
    fromSession
  );
}

export function meshBroadcastToAll(
  eventType: string,
  payload: object
): void {
  if (!_activeGroupFn) return;
  const keyHash = _activeGroupFn();
  if (!keyHash) return;
  meshBroadcast(keyHash, eventType, payload);
}
