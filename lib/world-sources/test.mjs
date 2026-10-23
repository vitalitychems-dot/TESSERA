import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollector, normalize, SOURCES } from './index.mjs';
import { seedWorldSourcesMemory } from './memory-seed.mjs';

const quake = { features: [{ id: 'fixture', properties: {
  title: 'Fixture earthquake', time: 1720000000000, mag: 3.1,
  url: 'https://earthquake.usgs.gov/earthquakes/eventpage/fixture',
}, geometry: { coordinates: [-98, 35, 5] } }] };
const json = (data) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('normalizes observations without inventing position or time', () => {
  assert.equal(normalize('usgs', quake)[0].magnitude, 3.1);
  assert.deepEqual(normalize('usgs', { features: [{ ...quake.features[0], geometry: { coordinates: [999, 35] } }] }), []);
  assert.throws(() => normalize('usgs', {}), /invalid_payload/);
  assert.throws(() => normalize('constructor', quake), /Unknown source/);
  const result = normalize('nws', { features: [{ id: 'https://api.weather.gov/alerts/fixture', properties: { sent: '2026-10-23T10:00:00Z', headline: '<script>untrusted</script>' } }] });
  assert.equal(result[0].location, null);
  assert.equal(result[0].title, '<script>untrusted</script>', 'data stays text; consumers must not use innerHTML');
});
test('selects latest EONET point and removes executable source URLs', () => {
  const [event] = normalize('eonet', { events: [{ id: 'x', title: 'Fire',
    sources: [{ url: 'javascript:alert(1)' }], geometry: [
      { type: 'Point', date: '2026-10-21', coordinates: [1, 2] },
      { type: 'Point', date: '2026-10-22', coordinates: [3, 4] },
    ] }] });
  assert.deepEqual(event.location, { longitude: 3, latitude: 4 });
  assert.deepEqual(event.references, []);
});
test('orbital elements are not labeled live coordinates', () => {
  const [record] = normalize('celestrak', [{ NORAD_CAT_ID: 25544, OBJECT_NAME: 'ISS',
    EPOCH: '2026-10-23T10:00:00Z', MEAN_MOTION: 15.4, INCLINATION: 51.6, ECCENTRICITY: 0.001 }]);
  assert.equal(record.kind, 'orbital-elements');
  assert.equal(record.location, null);
});
test('coalesces requests, enforces fixed URLs, and isolates cached values', async () => {
  let calls = 0;
  const collector = createCollector({ fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, SOURCES.usgs.url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return json(quake);
  } });
  const [first, second] = await Promise.all([collector.snapshot(['usgs']), collector.snapshot(['usgs'])]);
  first.sources[0].records[0].title = 'mutated';
  assert.equal(second.sources[0].records[0].title, 'Fixture earthquake');
  assert.equal(calls, 1);
  assert.equal((await collector.snapshot(['usgs'])).sources[0].records[0].title, 'Fixture earthquake');
  await assert.rejects(collector.snapshot(['https://localhost']), /known source/);
});
test('does not represent an outage as an empty successful feed, caches failures', async () => {
  let calls = 0;
  const collector = createCollector({ fetchImpl: async (url) => {
    calls++;
    return url === SOURCES.usgs.url ? json(quake) : new Response('down', { status: 503 });
  } });
  const report = await collector.snapshot(['usgs', 'eonet']);
  assert.equal(report.status, 'partial');
  assert.equal(report.sources[1].error, 'upstream_http_503');
  await collector.snapshot(['eonet']);
  assert.equal(calls, 2);
});
test('caps streamed response bytes and rejects invalid payloads', async () => {
  const oversized = createCollector({ fetchImpl: async () => new Response('x', {
    headers: { 'content-length': String(5 * 1024 * 1024) },
  }) });
  assert.equal((await oversized.snapshot(['usgs'])).sources[0].error, 'response_too_large');
  const streamed = createCollector({ fetchImpl: async () => new Response('x'.repeat(4 * 1024 * 1024 + 1)) });
  assert.equal((await streamed.snapshot(['usgs'])).sources[0].error, 'response_too_large');
});

test('usage-memory import matches Tessera store interface and is sequentially idempotent', async () => {
  const records = [];
  const store = { list: async () => records, record: async (record) => { records.push(record); } };
  assert.equal((await seedWorldSourcesMemory(store)).inserted, 4);
  assert.equal((await seedWorldSourcesMemory(store)).inserted, 0);
  assert.equal(records.length, 4);
  assert.ok(records.every((r) => r.sourceAgent && r.input && r.output && Array.isArray(r.tags)));
  await assert.rejects(seedWorldSourcesMemory({}), /MemoryStore/);
});
