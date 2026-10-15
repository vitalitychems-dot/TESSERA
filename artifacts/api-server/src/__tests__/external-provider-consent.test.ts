import { describe, expect, it } from "vitest";
import { containsPotentiallySensitiveExternalData, maySendToExternalProvider } from "../lib/tessera-chat-model";

describe("external provider chat consent", () => {
  it("is off unless the owner explicitly opts in", () => {
    expect(maySendToExternalProvider(false, "Explain how a prism works")).toBe(false);
    expect(maySendToExternalProvider(undefined, "Explain how a prism works")).toBe(false);
    expect(maySendToExternalProvider(true, "Explain how a prism works")).toBe(true);
  });

  it("keeps likely personal and credential material on the local path", () => {
    for (const text of [
      "Email me at owner@example.test",
      "My SSN is 123-45-6789",
      "Call me at (312) 555-0198",
      "Ship it to 42 Lake Road",
      "Card number 4111 1111 1111 1111",
      "api_key=synthetic_sensitive_credential_value_123456",
    ]) {
      expect(containsPotentiallySensitiveExternalData(text)).toBe(true);
      expect(maySendToExternalProvider(true, text)).toBe(false);
    }
  });
});
