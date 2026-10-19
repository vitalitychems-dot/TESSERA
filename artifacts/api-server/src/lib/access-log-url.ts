const REDACTED_SEGMENT = "redacted";
const SHA256_HEX = /^[0-9a-f]{64}$/i;

type PathPiece = { raw: string; decoded: string; split: boolean };

function decodeRepeated(segment: string): string {
  let current = segment;
  for (let pass = 0; pass < 3; pass += 1) {
    if (!current.includes("%")) return current;
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function expandPiece(raw: string): PathPiece[] {
  if (raw.length === 0) return [{ raw, decoded: "", split: false }];
  const decoded = decodeRepeated(raw);
  if (!decoded.includes("/")) return [{ raw, decoded, split: false }];
  return decoded.split("/").map((part) => ({ raw: part, decoded: part, split: true }));
}

function pathPart(decoded: string): string {
  const semi = decoded.indexOf(";");
  return semi === -1 ? decoded : decoded.slice(0, semi);
}

function rawPath(piece: PathPiece): string {
  if (piece.split) return pathPart(piece.decoded);
  const lower = piece.raw.toLowerCase();
  let cut = piece.raw.length;
  const semi = lower.indexOf(";");
  const encoded = lower.indexOf("%3b");
  if (semi !== -1) cut = Math.min(cut, semi);
  if (encoded !== -1) cut = Math.min(cut, encoded);
  return piece.raw.slice(0, cut);
}

function replaceHexRuns(value: string): string {
  return value.replace(/[0-9a-f]{64}/gi, REDACTED_SEGMENT);
}

function renderPiece(piece: PathPiece, fullyRedact: boolean): string {
  if (fullyRedact) return REDACTED_SEGMENT;
  const path = pathPart(piece.decoded);
  const hashed = replaceHexRuns(path);
  const hasParams = piece.decoded.includes(";");
  if (hashed !== path) return hasParams ? `${hashed};redacted` : hashed;
  if (hasParams) return `${rawPath(piece)};redacted`;
  return piece.split ? path : piece.raw;
}

/**
 * Access-log path with the query string removed.
 * Segments are decoded, including %2F boundaries, before matching so encoded
 * labels, matrix params, and glued digests still hide mesh session ids.
 */
export function redactAccessLogUrl(url: string | undefined): string | undefined {
  if (typeof url !== "string") return undefined;
  const path = url.split("?")[0] ?? "";
  const pieces = path.split("/").flatMap(expandPiece);
  const decoded = pieces.map((piece) => pathPart(piece.decoded));
  const named: number[] = [];
  for (let index = 0; index < decoded.length; index += 1) {
    if (decoded[index].length > 0) named.push(index);
  }
  const redact = new Set<number>();
  for (let position = 0; position < named.length; position += 1) {
    const index = named[position];
    const segment = decoded[index];
    const previous = position > 0 ? decoded[named[position - 1]].toLowerCase() : undefined;
    const beforePrevious = position > 1 ? decoded[named[position - 2]].toLowerCase() : undefined;
    if (previous === "sessions" && beforePrevious === "mesh" && segment.length > 0) {
      redact.add(index);
    }
    if (SHA256_HEX.test(segment)) redact.add(index);
  }
  return pieces
    .map((piece, index) => renderPiece(piece, redact.has(index)))
    .join("/");
}
