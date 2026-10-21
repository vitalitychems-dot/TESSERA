// Offline web access: dependency-free ZIM (Kiwix) reader + tiny writer for fixtures.
// Supports uncompressed clusters (compression 0/1). xz (4) and zstd (5) throw a clear
// ZimCompressionError: Node has no built-in xz/zstd and we add no dependencies.
import { openSync, readSync, closeSync, fstatSync } from "node:fs";

export const ZIM_MAGIC = 72173914;
export class ZimCompressionError extends Error {}

export function openZim(path) {
  const fd = openSync(path, "r");
  const size = fstatSync(fd).size;
  const read = (pos, len) => {
    const b = Buffer.alloc(len);
    const n = readSync(fd, b, 0, len, Number(pos));
    return n === len ? b : b.subarray(0, n);
  };
  const h = read(0, 80);
  if (h.length < 80 || h.readUInt32LE(0) !== ZIM_MAGIC) { closeSync(fd); throw new Error("not a ZIM file"); }
  const header = {
    major: h.readUInt16LE(4), minor: h.readUInt16LE(6),
    entryCount: h.readUInt32LE(24), clusterCount: h.readUInt32LE(28),
    urlPtrPos: h.readBigUInt64LE(32), titlePtrPos: h.readBigUInt64LE(40),
    clusterPtrPos: h.readBigUInt64LE(48), mimeListPos: h.readBigUInt64LE(56),
    mainPage: h.readUInt32LE(64),
  };
  // MIME list: NUL-terminated strings ending with an empty one.
  const mimes = [];
  let p = Number(header.mimeListPos);
  const mb = read(p, Math.min(65536, size - p));
  for (let i = 0; ; ) {
    const e = mb.indexOf(0, i);
    if (e < 0 || e === i) break;
    mimes.push(mb.toString("utf8", i, e)); i = e + 1;
  }
  const urlPtrs = read(header.urlPtrPos, header.entryCount * 8);
  const titlePtrs = read(header.titlePtrPos, header.entryCount * 4);
  const clusterPtrs = read(header.clusterPtrPos, header.clusterCount * 8);
  const entryCache = new Map();

  function entry(i) {
    if (entryCache.has(i)) return entryCache.get(i);
    const pos = urlPtrs.readBigUInt64LE(i * 8);
    const b = read(pos, 4096);
    const mime = b.readUInt16LE(0), ns = String.fromCharCode(b[3]);
    let off, e;
    if (mime === 0xffff) { e = { index: i, ns, redirect: b.readUInt32LE(8) }; off = 12; }
    else { e = { index: i, ns, mime: mimes[mime], cluster: b.readUInt32LE(8), blob: b.readUInt32LE(12) }; off = 16; }
    const u = b.indexOf(0, off); e.url = b.toString("utf8", off, u);
    const t = b.indexOf(0, u + 1); e.title = b.toString("utf8", u + 1, t) || e.url;
    entryCache.set(i, e);
    return e;
  }
  function blob(c, n) {
    const start = clusterPtrs.readBigUInt64LE(c * 8);
    const end = c + 1 < header.clusterCount ? clusterPtrs.readBigUInt64LE((c + 1) * 8) : BigInt(size);
    const info = read(start, 1)[0], comp = info & 0x0f, ext = info & 0x10 ? 8 : 4;
    if (comp === 4 || comp === 5) throw new ZimCompressionError(`cluster ${c} uses ${comp === 4 ? "xz" : "zstd"} compression; only uncompressed ZIM clusters are supported offline without deps`);
    if (comp > 1) throw new ZimCompressionError(`unsupported cluster compression ${comp}`);
    const d = read(start + 1n, Number(end - start - 1n));
    const rd = (k) => ext === 8 ? Number(d.readBigUInt64LE(k * ext)) : d.readUInt32LE(k * ext);
    return d.subarray(rd(n), rd(n + 1));
  }
  const resolve = (e, hops = 0) => (e.redirect === undefined || hops > 8 ? e : resolve(entry(e.redirect), hops + 1));
  // Binary search over URL-sorted pointer list (ns+url).
  function findByUrl(ns, url) {
    const key = ns + url;
    let lo = 0, hi = header.entryCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, e = entry(mid), k = e.ns + e.url;
      if (k === key) return e;
      if (k < key) lo = mid + 1; else hi = mid - 1;
    }
    return null;
  }
  return {
    header, mimes,
    entry, titleOrder: (i) => entry(titlePtrs.readUInt32LE(i * 4)),
    findByUrl,
    getContent(ns, url) {
      const e0 = findByUrl(ns, url); if (!e0) return null;
      const e = resolve(e0);
      return { entry: e, mime: e.mime, data: blob(e.cluster, e.blob) };
    },
    *entries() { for (let i = 0; i < header.entryCount; i++) yield entry(i); },
    content: (e) => { const r = resolve(e); return blob(r.cluster, r.blob); },
    close: () => closeSync(fd),
  };
}

// Minimal writer (one uncompressed cluster) for tests/fixtures.
// articles: [{ns:'C', url, title, mime, body}] ; redirects: [{ns,url,title,target:url}]
export function buildZim(articles, redirects = []) {
  const all = [...articles.map((a) => ({ ...a })), ...redirects.map((r) => ({ ...r, redir: true }))]
    .sort((a, b) => (a.ns + a.url < b.ns + b.url ? -1 : 1));
  const mimes = [...new Set(articles.map((a) => a.mime))];
  const blobs = articles.map((a) => Buffer.from(a.body));
  const blobIx = new Map(articles.map((a, i) => [a.ns + a.url, i]));
  const urlIx = new Map(all.map((a, i) => [a.ns + a.url, i]));
  const dirents = all.map((a) => {
    const fixed = Buffer.alloc(a.redir ? 12 : 16);
    fixed.writeUInt16LE(a.redir ? 0xffff : mimes.indexOf(a.mime), 0);
    fixed[3] = a.ns.charCodeAt(0);
    if (a.redir) fixed.writeUInt32LE(urlIx.get(a.ns + a.target), 8);
    else { fixed.writeUInt32LE(0, 8); fixed.writeUInt32LE(blobIx.get(a.ns + a.url), 12); }
    return Buffer.concat([fixed, Buffer.from(a.url + "\0" + (a.title ?? "") + "\0")]);
  });
  const mimeBuf = Buffer.from(mimes.join("\0") + "\0\0");
  const n = all.length;
  const mimePos = 80, urlPtrPos = mimePos + mimeBuf.length, titlePtrPos = urlPtrPos + n * 8;
  const clusterPtrPos = titlePtrPos + n * 4, direntPos = clusterPtrPos + 8;
  const urlPtrs = Buffer.alloc(n * 8); let p = direntPos;
  dirents.forEach((d, i) => { urlPtrs.writeBigUInt64LE(BigInt(p), i * 8); p += d.length; });
  const order = all.map((a, i) => [a.ns + (a.title || a.url), i]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const titlePtrs = Buffer.alloc(n * 4); order.forEach(([, i], k) => titlePtrs.writeUInt32LE(i, k * 4));
  const clusterPos = p;
  const offs = Buffer.alloc((blobs.length + 1) * 4); let o = offs.length;
  blobs.forEach((b, i) => { offs.writeUInt32LE(o, i * 4); o += b.length; }); offs.writeUInt32LE(o, blobs.length * 4);
  const cluster = Buffer.concat([Buffer.from([1]), offs, ...blobs]);
  const cptr = Buffer.alloc(8); cptr.writeBigUInt64LE(BigInt(clusterPos));
  const h = Buffer.alloc(80);
  h.writeUInt32LE(ZIM_MAGIC, 0); h.writeUInt16LE(6, 4); h.writeUInt16LE(1, 6);
  h.writeUInt32LE(n, 24); h.writeUInt32LE(1, 28);
  h.writeBigUInt64LE(BigInt(urlPtrPos), 32); h.writeBigUInt64LE(BigInt(titlePtrPos), 40);
  h.writeBigUInt64LE(BigInt(clusterPtrPos), 48); h.writeBigUInt64LE(BigInt(mimePos), 56);
  h.writeUInt32LE(0xffffffff, 64); h.writeUInt32LE(0xffffffff, 68);
  h.writeBigUInt64LE(BigInt(clusterPos + cluster.length), 72);
  return Buffer.concat([h, mimeBuf, urlPtrs, titlePtrs, cptr, ...dirents, cluster]);
}
