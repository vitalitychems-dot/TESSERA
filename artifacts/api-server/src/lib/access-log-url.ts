const REDACTED_SEGMENT = "redacted";
const SHA256_HEX = /^[0-9a-f]{64}$/i;

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Access-log path with the query string removed.
 * Each segment is decoded before matching so percent-encoded labels and
 * double slashes still hide mesh session ids and 64-hex digests.
 */
export function redactAccessLogUrl(url: string | undefined): string | undefined {
  if (typeof url !== "string") return undefined;
  const path = url.split("?")[0] ?? "";
  const segments = path.split("/");
  const decoded = segments.map(decodePathSegment);
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
  return segments
    .map((segment, index) => (redact.has(index) ? REDACTED_SEGMENT : segment))
    .join("/");
}
