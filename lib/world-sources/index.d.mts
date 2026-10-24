export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface OrbitalElements {
  meanMotion: number;
  inclination: number;
  eccentricity: number;
  rightAscension: number | null;
  argumentOfPericenter: number | null;
  meanAnomaly: number | null;
}

export interface WorldObservation {
  id: string;
  kind: string;
  title: string;
  source: WorldSourceId;
  observedAt: string;
  location: GeoPoint | null;
  url: string | null;
  magnitude?: number | null;
  depthKm?: number | null;
  expiresAt?: string | null;
  severity?: string;
  area?: string;
  categories?: string[];
  references?: string[];
  elements?: OrbitalElements;
}

export interface WorldSourceSuccess {
  source: WorldSourceId;
  status: "ok";
  fetchedAt: string;
  records: WorldObservation[];
  upstreamCount: number;
  truncated: boolean;
  attribution: string;
  endpoint: string;
}

export interface WorldSourceUnavailable {
  source: WorldSourceId;
  status: "unavailable";
  fetchedAt: string;
  records: [];
  error: string;
  attribution: string;
  endpoint: string;
}

export type WorldSourceResult = WorldSourceSuccess | WorldSourceUnavailable;
export type WorldSourceId = "usgs" | "eonet" | "nws" | "celestrak";

export interface WorldSnapshot {
  schema: "tessera.world-observations/v1";
  fetchedAt: string;
  status: "ok" | "partial" | "unavailable";
  sources: WorldSourceResult[];
}

export function normalize(source: WorldSourceId, payload: unknown): WorldObservation[];
export function createCollector(options?: {
  fetchImpl?: typeof fetch;
  now?: () => number;
}): {
  snapshot(ids?: WorldSourceId[]): Promise<WorldSnapshot>;
};
