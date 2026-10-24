/**
 * Original Tessera direct-source collector. No Cesium or upstream app imports.
 * Public reports are untrusted data, not instructions for an agent.
 */
export const SOURCES = Object.freeze({
  usgs: Object.freeze({
    name: 'USGS Earthquake Hazards Program',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    documentation: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
    attribution: 'U.S. Geological Survey; retain report links and timestamps.',
    ttlMs: 60_000,
  }),
  eonet: Object.freeze({
    name: 'NASA Earth Observatory Natural Event Tracker',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50&days=30',
    documentation: 'https://eonet.gsfc.nasa.gov/docs/v3',
    attribution: 'NASA EONET; underlying reports retain their source attribution.',
    ttlMs: 300_000,
  }),
  nws: Object.freeze({
    name: 'NOAA National Weather Service',
    url: 'https://api.weather.gov/alerts/active?status=actual&message_type=alert',
    documentation: 'https://www.weather.gov/documentation/services-web-api',
    attribution: 'NOAA National Weather Service. Not a life-safety alerting service.',
    ttlMs: 60_000,
  }),
  celestrak: Object.freeze({
    name: 'CelesTrak space-station general perturbation elements',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
    documentation: 'https://celestrak.org/NORAD/documentation/gp-data-formats.php',
    attribution: 'CelesTrak GP data; orbital elements are not observed live positions.',
    ttlMs: 3_600_000,
  }),
});

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 500;
const text = (value, max = 600) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
function date(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const stamp = new Date(value);
  return Number.isFinite(stamp.getTime()) ? stamp.toISOString() : null;
}
function link(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}
function point(coordinates) {
  if (!Array.isArray(coordinates)) return null;
  const [longitude, latitude] = coordinates;
  return number(longitude) !== null && Math.abs(longitude) <= 180 &&
    number(latitude) !== null && Math.abs(latitude) <= 90
    ? { longitude, latitude } : null;
}
const list = (value) => {
  if (!Array.isArray(value)) throw new Error('invalid_payload');
  return value.slice(0, MAX_RECORDS);
};

/** Exported for offline schema checks. Does not fetch or execute source data. */
export function normalize(source, payload) {
  if (!Object.hasOwn(SOURCES, source)) throw new TypeError('Unknown source');
  if (source === 'usgs') return list(payload?.features).flatMap((feature) => {
    const p = feature?.properties;
    const location = point(feature?.geometry?.coordinates);
    if (!p || !location || !date(p.time)) return [];
    return [{
      id: text(String(feature.id ?? ''), 180), kind: 'earthquake',
      title: text(p.title), observedAt: date(p.time), location,
      magnitude: number(p.mag), depthKm: number(feature.geometry.coordinates[2]),
      url: link(p.url),
    }];
  });
  if (source === 'eonet') return list(payload?.events).flatMap((event) => {
    if (!event || typeof event.id !== 'string' || !Array.isArray(event.geometry)) return [];
    const geometries = event.geometry.filter((g) => g?.type === 'Point' && point(g.coordinates) && date(g.date));
    const latest = geometries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    if (!latest) return [];
    return [{
      id: text(event.id, 180), kind: 'natural-event', title: text(event.title),
      observedAt: date(latest.date), location: point(latest.coordinates),
      categories: Array.isArray(event.categories)
        ? event.categories.slice(0, 12).map((c) => text(c?.title, 100)) : [],
      references: Array.isArray(event.sources)
        ? event.sources.slice(0, 12).map((s) => link(s?.url)).filter(Boolean) : [],
      url: link(event.link),
    }];
  });
  if (source === 'nws') return list(payload?.features).flatMap((feature) => {
    const p = feature?.properties;
    if (!p || !date(p.sent) || typeof feature.id !== 'string') return [];
    return [{
      id: text(feature.id, 400), kind: 'weather-alert',
      title: text(p.headline || p.event), observedAt: date(p.sent),
      expiresAt: date(p.expires), severity: text(p.severity, 60),
      area: text(p.areaDesc), location: null,
      // No invented centroid: NWS alerts may supply a polygon or only a zone.
      url: link(feature.id),
    }];
  });
  return list(payload).flatMap((p) => {
    const epoch = date(p?.EPOCH);
    if (!p || !Number.isSafeInteger(p.NORAD_CAT_ID) || !epoch ||
        number(p.MEAN_MOTION) === null || number(p.INCLINATION) === null ||
        number(p.ECCENTRICITY) === null || p.ECCENTRICITY < 0 || p.ECCENTRICITY >= 1) return [];
    return [{
      id: String(p.NORAD_CAT_ID), kind: 'orbital-elements',
      title: text(p.OBJECT_NAME), observedAt: epoch, location: null,
      elements: {
        meanMotion: p.MEAN_MOTION, inclination: p.INCLINATION,
        eccentricity: p.ECCENTRICITY, rightAscension: number(p.RA_OF_ASC_NODE),
        argumentOfPericenter: number(p.ARG_OF_PERICENTER), meanAnomaly: number(p.MEAN_ANOMALY),
      },
      url: SOURCES.celestrak.documentation,
    }];
  });
}

async function boundedJson(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error('response_too_large');
  }
  if (!response.body) throw new Error('empty_response');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('response_too_large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(joined));
}

/** Fixed allow-listed endpoints; no arbitrary outbound URLs or credentials. */
export function createCollector({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function readSource(id) {
    if (!Object.hasOwn(SOURCES, id)) throw new TypeError('Unknown source');
    const config = SOURCES[id];
    const existing = cache.get(id);
    if (existing && existing.until > now()) return structuredClone(existing.value);
    if (pending.has(id)) return structuredClone(await pending.get(id));
    const task = (async () => {
      const fetchedAt = new Date(now()).toISOString();
      let value;
      try {
        const response = await fetchImpl(config.url, {
          signal: AbortSignal.timeout(10_000), redirect: 'error',
          headers: {
            Accept: 'application/geo+json, application/json',
            'User-Agent': 'TesseraWorldSources/0.1 (+https://github.com/vitalitychems-dot/TESSERA)',
          },
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`upstream_http_${response.status}`);
        }
        const payload = await boundedJson(response);
        const records = normalize(id, payload).map((record) => ({ ...record, source: id }));
        value = {
          source: id, status: 'ok', fetchedAt, records,
          upstreamCount: Array.isArray(payload) ? payload.length :
            Array.isArray(payload?.features) ? payload.features.length : payload.events.length,
          truncated: (Array.isArray(payload) ? payload.length :
            (payload.features ?? payload.events).length) > MAX_RECORDS,
          attribution: config.attribution, endpoint: config.url,
        };
      } catch (error) {
        const code = /^upstream_http_\d{3}$|^response_too_large$|^invalid_payload$|^empty_response$/.test(error?.message)
          ? error.message : error?.name === 'TimeoutError' ? 'upstream_timeout' : 'upstream_unavailable';
        value = { source: id, status: 'unavailable', fetchedAt, records: [], error: code,
          attribution: config.attribution, endpoint: config.url };
      }
      cache.set(id, { until: now() + (value.status === 'ok' ? config.ttlMs : 30_000), value });
      return value;
    })();
    pending.set(id, task);
    try { return structuredClone(await task); }
    finally { pending.delete(id); }
  }
  return {
    async snapshot(ids = Object.keys(SOURCES)) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 4 ||
          ids.some((id) => typeof id !== 'string' || !Object.hasOwn(SOURCES, id))) {
        throw new TypeError('Choose one to four known source IDs');
      }
      const sources = await Promise.all([...new Set(ids)].map(readSource));
      const ok = sources.filter((s) => s.status === 'ok').length;
      return {
        schema: 'tessera.world-observations/v1', fetchedAt: new Date(now()).toISOString(),
        status: ok === sources.length ? 'ok' : ok ? 'partial' : 'unavailable',
        sources,
      };
    },
  };
}
