/**
 * v3 Prism Laser-Crystal resolver:
 *  - storage is the crystal warehouse holding deduplicated raw/structured records (repos.json,
 *    rea-permitted-148.json, content-dedupe-manifest.json).
 *  - memory holds the learned 5D (x, y, z, t, v) crystal cells and one-line FACETS.md index.
 *  - prismResolve() aims Tessera's laser at a query, scores 5D crystal nodes + facets, packs
 *    matched context within a strict token budget via packV3/fitBudget, and pulls the verified
 *    item from storage wrapped in a nonce-tagged <untrusted> envelope.
 */
import { createHash, randomBytes } from "node:crypto";
import { graphAt, positions, verify } from "./crystal.mjs";
import { tokens, entityText, idfTable, packV3, fitBudget } from "./pack.mjs";
import { createRanker } from "../../v2/src/brain/context.mjs";

const REFUSED_RE =
  /\b(?:heretic|flaresolverr|scrapling|zzzzz|stalky|vitality|vitalitychems|1t|stripe|peptide|cameradar|bettercap|wifiphisher|wifi-cracking|phoneinfoga|maigret|sherlock|theharvester|spiderfoot|amass|bbot|ghosttrack|shadowbroker|ruview|sparrowmap|gods-eye-view)\b/i;

export function escapeUntrusted(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrapStorageUntrusted(text, { role = "storage", label = "item", nonce } = {}) {
  const token = (nonce ?? randomBytes(8).toString("hex")).replace(/[^A-Za-z0-9_-]/g, "");
  const safeRole = escapeUntrusted(role).replace(/"/g, "&quot;");
  const safeLabel = escapeUntrusted(label).replace(/"/g, "&quot;");
  return `<untrusted nonce="${token}" role="${safeRole}" label="${safeLabel}">\n${escapeUntrusted(text)}\n</untrusted nonce="${token}">`;
}

export function parseFacets(facetsText) {
  const out = [];
  for (const raw of String(facetsText ?? "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes(" | ")) continue;
    const parts = line.split(" | ").map((p) => p.trim());
    if (parts.length < 3) continue;
    const id = parts[0];
    const kwPart = parts[1].replace(/^keywords:\s*/i, "");
    const keywords = kwPart.split(",").map((k) => k.trim()).filter(Boolean);
    const source = parts[2];
    const reuse = parts.slice(3).join(" | ");
    out.push({ id, keywords, source, reuse, raw: line });
  }
  return out;
}

function queryTerms(query) {
  return String(query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((w) => w.length >= 2);
}

export function prismResolve(
  query,
  {
    crystalCells = [],
    v2MemoryRows = [],
    facetsText = "",
    storageCatalog = null,
    dedupeManifest = null,
    budgetTokens = 391,
    topK = 5,
    nonce = null,
  } = {},
) {
  const q = String(query ?? "").trim();
  if (!q || REFUSED_RE.test(q)) {
    return {
      ok: false,
      refused: Boolean(q && REFUSED_RE.test(q)),
      reason: q ? "PEN-REFUSE-BOUNDARY" : "EMPTY_QUERY",
      query: q,
      laserTarget: null,
      matchedFacets: [],
      crystalCoordinates: null,
      packedContext: "",
      packedTokens: 0,
      budgetTokens,
      storageItem: null,
      dedupeResolution: null,
      integrityVerified: false,
    };
  }

  const integrityErrors = Array.isArray(crystalCells) && crystalCells.length ? verify(crystalCells) : 0;
  const g = graphAt(crystalCells);
  const posMap = positions(crystalCells);
  const facets = parseFacets(facetsText);
  const terms = queryTerms(q);

  const scoredFacets = facets
    .map((f) => {
      const hay = `${f.id} ${f.keywords.join(" ")} ${f.source} ${f.reuse}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (f.id.toLowerCase() === t) score += 6;
        else if (f.keywords.some((k) => k.toLowerCase() === t || k.toLowerCase().endsWith(`/${t}`))) score += 4;
        else if (hay.includes(t)) score += 1;
      }
      return { facet: f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.facet.id.localeCompare(b.facet.id));

  const matchedFacets = scoredFacets.slice(0, topK).map((x) => x.facet);

  const nodeScores = [];
  for (const [id, meta] of g.nodes.entries()) {
    const text = `${id} ${meta.text ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (id.toLowerCase() === t || id.toLowerCase() === `repo::${t}` || id.toLowerCase().endsWith(`/${t}`)) score += 8;
      else if (text.includes(t)) score += 2;
    }
    if (score > 0) nodeScores.push([id, score]);
  }
  nodeScores.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const seed = nodeScores[0]?.[0] ?? (g.nodes.has("rea::v2::TESSERA") ? "rea::v2::TESSERA" : [...g.nodes.keys()][0] ?? null);
  const rank = g.nodes.size > 0 ? createRanker(g) : () => [];
  const rankedNeighbors = seed ? rank(seed, topK * 2) : [];
  const rankedIds = [];
  for (const [id] of nodeScores.slice(0, topK)) {
    if (!rankedIds.includes(id)) rankedIds.push(id);
  }
  for (const id of rankedNeighbors) {
    if (rankedIds.length >= topK * 2) break;
    if (!rankedIds.includes(id)) rankedIds.push(id);
  }

  const E = entityText(v2MemoryRows);
  const idf = idfTable(E);
  const packFn = (ids) => packV3(E, ids, { idf, sink: 16 });
  const fittedIds = rankedIds.length ? fitBudget(packFn, rankedIds, budgetTokens) : [];
  const packedContext = fittedIds.length ? packFn(fittedIds) : "";
  const packedTokens = tokens(packedContext);

  const laserTarget = fittedIds[0] ?? matchedFacets[0]?.id ?? null;
  let crystalCoordinates = null;
  if (laserTarget && g.nodes.has(laserTarget)) {
    const factCell = crystalCells.find((c) => c.k === "n" && c.id === laserTarget);
    const h = factCell?.h;
    crystalCoordinates = {
      id: laserTarget,
      h: h ?? null,
      p: posMap.get(laserTarget) ?? null,
      t: factCell?.t ?? null,
      v: h ? (g.val.get(h) ?? 1) : 1,
      src: h ? (g.src.get(h) ?? null) : null,
    };
  }

  let storageItem = null;
  let hashVerified = integrityErrors === 0;
  if (storageCatalog) {
    const items = storageCatalog.cards ?? storageCatalog.items ?? [];
    const hit = items.find((item) => {
      const slug = (item.repo ?? item.id ?? "").toLowerCase();
      const url = (item.url ?? item.repo_url?.value ?? "").toLowerCase();
      return terms.some((t) => slug === t || slug.endsWith(`/${t}`) || url.endsWith(`/${t}`) || (item.id ?? "").toLowerCase() === t);
    });
    if (hit) {
      if (hit.content_sha256) {
        const clone = { ...hit };
        delete clone.content_sha256;
        delete clone.secret_scan;
        const sortedJson = JSON.stringify(clone, Object.keys(clone).sort());
        const computed = createHash("sha256").update(sortedJson).digest("hex");
        hashVerified = hashVerified && computed === hit.content_sha256;
      }
      const summaryText = hit.purpose?.value ?? hit.purpose ?? JSON.stringify(hit);
      storageItem = {
        id: hit.id ?? hit.repo,
        repo: hit.repo ?? hit.id,
        head_sha: hit.head_sha ?? hit.repo_url?.head_sha ?? null,
        license: hit.license?.spdx ?? hit.license?.value ?? null,
        content_sha256: hit.content_sha256 ?? hit.card_content_sha256 ?? null,
        wrappedPayload: wrapStorageUntrusted(summaryText, {
          role: "storage",
          label: String(hit.repo ?? hit.id),
          nonce,
        }),
      };
    }
  }

  let dedupeResolution = null;
  if (dedupeManifest) {
    const sameDiff = (dedupeManifest.same_name_different_content ?? []).find((r) =>
      terms.some((t) => r.source.toLowerCase().includes(t) || (r.disambiguated_storage_path ?? "").toLowerCase().includes(t)),
    );
    const newUnique = (dedupeManifest.new_unique_content ?? []).find((r) =>
      terms.some((t) => r.source.toLowerCase().includes(t) || (r.storage_path ?? "").toLowerCase().includes(t)),
    );
    const exactMatch = (dedupeManifest.exact_content_matches_sample ?? []).find((r) =>
      terms.some((t) => r.canonical_path.toLowerCase().includes(t) || r.duplicate_sources.some((s) => s.toLowerCase().includes(t))),
    );
    if (sameDiff) {
      dedupeResolution = { kind: "SAME_NAME_DIFFERENT_CONTENT", record: sameDiff };
    } else if (newUnique) {
      dedupeResolution = { kind: "NEW_UNIQUE_CONTENT", record: newUnique };
    } else if (exactMatch) {
      dedupeResolution = { kind: "EXACT_CONTENT_MATCH", record: exactMatch };
    }
  }

  return {
    ok: true,
    refused: false,
    reason: null,
    query: q,
    laserTarget,
    matchedFacets,
    crystalCoordinates,
    packedContext,
    packedTokens,
    budgetTokens,
    storageItem,
    dedupeResolution,
    integrityVerified: hashVerified,
  };
}
