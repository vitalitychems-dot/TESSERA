const OPTIONAL_STORAGE_ROUTE_PREFIXES = [
  "/storage/objects/",
  "/storage/public-objects/",
] as const;

/** A synthetic placeholder cannot establish that a real stored object exists. */
export function isOptionalStorageResourceRoute(path: string): boolean {
  return OPTIONAL_STORAGE_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** These GETs can correctly return 404 before their first resource is created. */
export function isExpectedEmptyState404(path: string, hasParams: boolean): boolean {
  return hasParams || path === "/improvement-conference/verdict";
}
