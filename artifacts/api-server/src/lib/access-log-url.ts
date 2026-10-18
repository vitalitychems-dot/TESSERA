const REDACTED_SEGMENT = "redacted";
const SHA256_HEX = /^[0-9a-f]{64}$/i;

/**
 * Access-log path with the query string removed.
 * Mesh and session segment names are matched case-insensitively.
 * The segment after /mesh/sessions/ is removed, and any 64-hex segment is removed.
 */
export function redactAccessLogUrl(url: string | undefined): string | undefined {
  if (typeof url !== "string") return undefined;
  const path = url.split("?")[0] ?? "";
  const segments = path.split("/");
  return segments
    .map((segment, index) => {
      const previous = segments[index - 1]?.toLowerCase();
      const beforePrevious = segments[index - 2]?.toLowerCase();
      if (previous === "sessions" && beforePrevious === "mesh" && segment.length > 0) {
        return REDACTED_SEGMENT;
      }
      if (SHA256_HEX.test(segment)) return REDACTED_SEGMENT;
      return segment;
    })
    .join("/");
}
