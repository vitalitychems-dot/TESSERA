/** The bridge puts its rule block before the question. The file lookup must read the question only. */
export function stripBridgeRule(text: string) {
  return text.replace(/^BRIDGE\.[^\n]*\n\n/, "");
}
