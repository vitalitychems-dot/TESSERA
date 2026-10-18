const REDACTED_SEGMENT = "redacted";
const SHA256_HEX = /^[0-9a-f]{64}$/i;

function isMeshOrSessionSegment(segment: string): boolean {
  return segment === "mesh" || segment === "session" || segment === "sessions";
}

/**
 * Access-log path with the query string removed.
 * On mesh and session routes, replace the :keyHash segment and any sha256 path segment.
 */
export function redactAccessLogUrl(url: string | undefined): string | undefined {
  if (typeof url !== "string") return undefined;
  const path = url.split("?")[0] ?? "";
  const segments = path.split("/");
  if (!segments.some(isMeshOrSessionSegment)) return path;
  return segments
    .map((segment, index) => {
      const previous = segments[index - 1];
      const beforePrevious = segments[index - 2];
      if (previous === "sessions" && beforePrevious === "mesh" && segment.length > 0) {
        return REDACTED_SEGMENT;
      }
      if (SHA256_HEX.test(segment)) return REDACTED_SEGMENT;
      return segment;
    })
    .join("/");
}
