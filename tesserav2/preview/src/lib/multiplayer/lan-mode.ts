/** LAN mode for p2p.ts: no public STUN/TURN, host candidates only, local signaling URL. */
export function lanIceServers(): RTCIceServer[] { return []; }
export function isLocalSignal(url: string) {
  return /^(\/|https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/.test(url);
}
export function lanRoomConfig(signalUrl = "/api/rtc") {
  if (!isLocalSignal(signalUrl)) throw new Error("LAN mode needs a local signaling url");
  return { iceServers: lanIceServers(), signalUrl, iceTransportPolicy: "all" as const };
}
