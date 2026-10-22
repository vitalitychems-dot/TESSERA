/**
 * Keyless live-data adapters. Declarative spec per source (api-anything style:
 * one endpoint description -> request builder + normalizer), so adding a source
 * is data, not code. Rules: official endpoints only, no keys, no login, no proxies,
 * no IP rotation, no scraping. `rps` is set BELOW each published limit.
 */
export const UA = "TESSERA-shepherd/1.0 (+https://github.com/vitalitychems-dot/TESSERA; 332565808+vitalitychems-dot@users.noreply.github.com)";
const MAILTO = "332565808+vitalitychems-dot@users.noreply.github.com";
// Location used by the location-based sources (open-meteo, nominatim, overpass).
// Neutral public default (Paris city centre); override with TESSERA_LIVE_LAT / TESSERA_LIVE_LON / TESSERA_LIVE_CITY.
const ENV = (typeof process !== "undefined" && process.env) || {};
const envNum = (v, d) => (Number.isFinite(Number.parseFloat(v)) ? Number.parseFloat(v) : d);
export const LIVE_LAT = envNum(ENV.TESSERA_LIVE_LAT, 48.8566);
export const LIVE_LON = envNum(ENV.TESSERA_LIVE_LON, 2.3522);
export const LIVE_CITY = ENV.TESSERA_LIVE_CITY || "Paris";
const LIVE_BBOX = [LIVE_LAT - 0.01, LIVE_LON - 0.01, LIVE_LAT + 0.01, LIVE_LON + 0.01].map((x) => x.toFixed(4)).join(",");
const q = (o) => new URLSearchParams(o).toString();
const first = (a, n = 5) => (Array.isArray(a) ? a.slice(0, n) : []);

// rps = our pace (req/s); published = provider's stated limit; ttlS = min seconds between pulls of same URL.
export const SOURCES = [
  { id: "wikipedia", license: "CC BY-SA 4.0", published: "~200 req/s guideline, UA required", rps: 5, ttlS: 3600,
    url: () => "https://en.wikipedia.org/api/rest_v1/page/summary/Earth",
    parse: (j) => [{ title: j.title, text: j.extract }] },
  { id: "wikidata", license: "CC0", published: "SPARQL 60 s query-time/min per IP", rps: 0.2, ttlS: 3600,
    url: () => "https://www.wikidata.org/w/api.php?" + q({ action: "wbgetentities", ids: "Q2", props: "labels", languages: "en", format: "json" }),
    parse: (j) => Object.values(j.entities || {}).map((e) => ({ id: e.id, title: e.labels?.en?.value })) },
  { id: "arxiv", license: "metadata CC0", published: "1 req / 3 s", rps: 0.25, ttlS: 3600, format: "text",
    url: () => "https://export.arxiv.org/api/query?" + q({ search_query: "cat:cs.AI", max_results: "5", sortBy: "submittedDate" }),
    parse: (t) => [...t.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map((m) => ({ title: m[1].trim().replace(/\s+/g, " ") })) },
  { id: "github", license: "GitHub ToS (public data)", published: "60 req/h per IP unauthenticated", rps: 30 / 3600, ttlS: 3600,
    url: () => "https://api.github.com/repos/nodejs/node/releases?per_page=5",
    parse: (j) => first(j).map((r) => ({ title: r.name || r.tag_name, url: r.html_url })) },
  { id: "npm", license: "npm ToS", published: "generous, cache required", rps: 2, ttlS: 3600,
    url: () => "https://registry.npmjs.org/three/latest", parse: (j) => [{ title: `${j.name}@${j.version}` }] },
  { id: "pypi", license: "PSF ToS", published: "generous, CDN cached", rps: 2, ttlS: 3600,
    url: () => "https://pypi.org/pypi/numpy/json", parse: (j) => [{ title: `${j.info?.name}@${j.info?.version}` }] },
  { id: "nasa-eonet", license: "US Gov public domain", published: "not published", rps: 0.5, ttlS: 900,
    url: () => "https://eonet.gsfc.nasa.gov/api/v3/events?limit=5&status=open",
    parse: (j) => first(j.events).map((e) => ({ id: e.id, title: e.title })) },
  { id: "nasa-images", license: "mostly public domain (per item)", published: "not published", rps: 0.5, ttlS: 3600,
    url: () => "https://images-api.nasa.gov/search?q=nebula&media_type=image&page_size=5",
    parse: (j) => first(j.collection?.items).map((i) => ({ title: i.data?.[0]?.title, id: i.data?.[0]?.nasa_id })) },
  { id: "nasa-sscweb", license: "public domain", published: "not published", rps: 0.2, ttlS: 3600,
    url: () => "https://sscweb.gsfc.nasa.gov/WS/sscr/2/observatories", headers: { Accept: "application/json" },
    parse: (j) => first(j?.[1]?.Observatory?.[1]).map((o) => o?.[1] || {}).map((o) => ({ id: o.Id, title: o.Name })) }, // Java-typed JSON: [class, value]
  { id: "celestrak", license: "free use, credit CelesTrak", published: "data updates ~2 h; don't poll faster", rps: 0.1, ttlS: 7200,
    url: () => "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json",
    parse: (j) => first(j).map((s) => ({ id: String(s.NORAD_CAT_ID), title: s.OBJECT_NAME })) },
  { id: "usgs-quakes", license: "public domain", published: "feeds refresh each minute", rps: 0.5, ttlS: 120,
    url: () => "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    parse: (j) => first(j.features).map((f) => ({ id: f.id, title: f.properties?.title })) },
  { id: "nws", license: "public domain; UA required", published: "unpublished, ~a few req/s", rps: 0.5, ttlS: 600, headers: { Accept: "application/geo+json" },
    url: () => "https://api.weather.gov/alerts/active?area=IL",
    parse: (j) => first(j.features).map((f) => ({ id: f.id, title: f.properties?.headline })) },
  { id: "noaa-swpc", license: "public domain", published: "static JSON; poll >= 1 min", rps: 0.2, ttlS: 300,
    url: () => "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
    parse: (j) => first(j.slice?.(-5)).map((r) => ({ title: `Kp ${r.kp_index ?? r.estimated_kp} @ ${r.time_tag}` })) },
  { id: "open-meteo", license: "CC BY 4.0; free non-commercial", published: "600/min, 5k/h, 10k/day", rps: 0.1, ttlS: 900,
    url: () => `https://api.open-meteo.com/v1/forecast?latitude=${LIVE_LAT}&longitude=${LIVE_LON}&current=temperature_2m,wind_speed_10m`,
    parse: (j) => [{ title: `${LIVE_CITY} ${j.current?.temperature_2m}°C wind ${j.current?.wind_speed_10m}` }] },
  { id: "nominatim", license: "ODbL; usage policy (no bulk)", published: "max 1 req/s, UA required", rps: 0.5, ttlS: 86400,
    url: () => "https://nominatim.openstreetmap.org/search?" + q({ q: LIVE_CITY, format: "jsonv2", limit: "1" }),
    parse: (j) => first(j).map((p) => ({ title: p.display_name })) },
  { id: "overpass", license: "ODbL", published: "~10k queries/day, fair use", rps: 0.05, ttlS: 86400,
    url: () => "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(`[out:json][timeout:25];node["amenity"="library"](${LIVE_BBOX});out 5;`),
    parse: (j) => first(j.elements).map((e) => ({ id: String(e.id), title: e.tags?.name })) },
  { id: "osm-tiles", license: "ODbL; tile usage policy", published: "light interactive use only; offline bulk download banned",
    rps: 0, ttlS: 0, disabled: "tile policy bans bulk/offline prefetch; serve offline packs from our own tile server",
    url: () => "https://tile.openstreetmap.org/0/0/0.png", parse: () => [] },
  { id: "hn", license: "public; YC ToS", published: "no limit stated", rps: 1, ttlS: 300,
    url: () => "https://hacker-news.firebaseio.com/v0/topstories.json", parse: (j) => first(j).map((id) => ({ id: String(id) })) },
  { id: "hn-algolia", license: "public", published: "~10k req/h per IP", rps: 1, ttlS: 300,
    url: () => "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5",
    parse: (j) => first(j.hits).map((h) => ({ id: h.objectID, title: h.title })) },
  { id: "gdelt", license: "free, credit GDELT", published: "~1 req / 5 s", rps: 0.1, ttlS: 900,
    url: () => "https://api.gdeltproject.org/api/v2/doc/doc?" + q({ query: "science", mode: "artlist", maxrecords: "5", format: "json" }),
    parse: (j) => first(j.articles).map((a) => ({ title: a.title, url: a.url })) },
  { id: "semantic-scholar", license: "S2 API license", published: "~1 req/s shared unauthenticated pool", rps: 0.2, ttlS: 3600,
    url: () => "https://api.semanticscholar.org/graph/v1/paper/search?query=spiking+neural+network&limit=5&fields=title",
    parse: (j) => first(j.data).map((p) => ({ id: p.paperId, title: p.title })) },
  { id: "openalex", license: "CC0", published: "10 req/s, 100k/day (mailto)", rps: 2, ttlS: 3600,
    url: () => "https://api.openalex.org/works?" + q({ search: "neuroscience", "per-page": "5", mailto: MAILTO }),
    parse: (j) => first(j.results).map((w) => ({ id: w.id, title: w.title })) },
  { id: "crossref", license: "metadata mostly CC0", published: "polite pool with mailto (~10 req/s)", rps: 2, ttlS: 3600,
    url: () => "https://api.crossref.org/works?" + q({ query: "physiology", rows: "5", mailto: MAILTO }),
    parse: (j) => first(j.message?.items).map((w) => ({ id: w.DOI, title: w.title?.[0] })) },
  { id: "ncbi-eutils", license: "public; NLM terms", published: "3 req/s without key", rps: 1, ttlS: 3600,
    url: () => "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?" + q({ db: "pubmed", term: "neurology", retmax: "5", retmode: "json", tool: "tessera", email: MAILTO }),
    parse: (j) => first(j.esearchresult?.idlist).map((id) => ({ id })) },
  { id: "europe-pmc", license: "open; per-article license", published: "fair use", rps: 1, ttlS: 3600,
    url: () => "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + q({ query: "medicine OPEN_ACCESS:y", format: "json", pageSize: "5" }),
    parse: (j) => first(j.resultList?.result).map((r) => ({ id: r.id, title: r.title })) },
  { id: "data-gov", license: "mostly public domain", published: "fair use", rps: 0.5, ttlS: 3600,
    disabled: "catalog.data.gov/api/3 returned 404 on 2026-10-12; re-enable once the new catalog API is confirmed",
    url: () => "https://catalog.data.gov/api/3/action/package_search?q=weather&rows=5",
    parse: (j) => first(j.result?.results).map((d) => ({ id: d.name, title: d.title })) },
  { id: "world-bank", license: "CC BY 4.0", published: "fair use", rps: 1, ttlS: 86400,
    url: () => "https://api.worldbank.org/v2/country/US/indicator/SP.POP.TOTL?format=json&per_page=5",
    parse: (j) => first(j[1]).map((r) => ({ title: `${r.country?.value} pop ${r.date}: ${r.value}` })) },
  { id: "internet-archive", license: "per-item rights; IA ToS", published: "fair use, back off on 429", rps: 0.5, ttlS: 3600,
    url: () => "https://archive.org/advancedsearch.php?" + q({ q: "collection:opensource AND mediatype:texts", "fl[]": "identifier", rows: "5", output: "json" }),
    parse: (j) => first(j.response?.docs).map((d) => ({ id: d.identifier })) },
  { id: "open-library", license: "CC0 metadata", published: "~1 req/s guideline", rps: 0.5, ttlS: 86400,
    url: () => "https://openlibrary.org/search.json?q=biology&limit=5&fields=key,title",
    parse: (j) => first(j.docs).map((d) => ({ id: d.key, title: d.title })) },
  { id: "gutendex", license: "public-domain texts", published: "fair use", rps: 0.5, ttlS: 86400,
    url: () => "https://gutendex.com/books/?search=physics",
    parse: (j) => first(j.results).map((b) => ({ id: String(b.id), title: b.title })) },
  { id: "frankfurter", license: "free, ECB data (reference only, not for trading)", published: "fair use", rps: 0.2, ttlS: 86400,
    url: () => "https://api.frankfurter.app/latest?from=USD",
    parse: (j) => [{ title: `ECB ref ${j.date}: EUR ${j.rates?.EUR}` }] },
  { id: "rest-countries", license: "MPL-2.0", published: "fair use", rps: 0.5, ttlS: 86400,
    url: () => "https://restcountries.com/v3.1/alpha/US?fields=name,capital,population",
    parse: (j) => [{ title: `${j.name?.common}: ${j.capital?.[0]}, pop ${j.population}` }] },
  { id: "pokeapi", license: "fair use, cache required", published: "~100/min", rps: 0.5, ttlS: 86400,
    url: () => "https://pokeapi.co/api/v2/pokemon/1", parse: (j) => [{ id: String(j.id), title: j.name }] },
  { id: "wikimedia-eventstreams", license: "CC BY-SA / CC0", published: "one connection per client", rps: 0.05, ttlS: 60, format: "sse", maxEvents: 5, headers: { Accept: "text/event-stream" },
    url: () => "https://stream.wikimedia.org/v2/stream/recentchange",
    parse: (events) => events.map((e) => ({ id: String(e.id ?? ""), title: `${e.wiki}: ${e.title}` })) },
];

export const byId = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

/** Parse an SSE body into JSON events (bounded). */
export function parseSse(text, max = 5) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try { out.push(JSON.parse(line.slice(5).trim())); } catch {}
    if (out.length >= max) break;
  }
  return out;
}
