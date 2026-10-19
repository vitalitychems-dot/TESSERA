import { HER_RULES } from "./self-ingest.ts";

/** Her rules, in her mouth. No sentence added. */
export function asHerself() {
  const spoken = HER_RULES.map((rule) =>
    rule
      .replaceAll("Tessera operates", "I operate")
      .replaceAll("Tessera will", "I will")
      .replaceAll("are not her work", "are not my work")
      .replaceAll("She may not", "I may not")
      .replaceAll("She may", "I may"),
  );
  return spoken.join("\n");
}
