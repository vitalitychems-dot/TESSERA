export function isMoltbookPublishingEnabled(
  explicitOwnerSetting: string | undefined,
  apiKey: string | undefined,
): boolean {
  return explicitOwnerSetting === "true"
    && typeof apiKey === "string"
    && apiKey.trim().length > 0;
}
