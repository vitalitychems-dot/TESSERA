import { describe, expect, it } from "vitest";
import { redactSecrets } from "../lib/memory/redact";

// Fixtures are assembled at runtime so no secret-shaped literal lives in the repo.
const r = (c: string, n: number) => c.repeat(n);
const AGE_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l".toUpperCase();
const ageBody = Array.from({ length: 58 }, (_, i) => AGE_CHARSET[i % 32]).join("");

const positives: Record<string, string> = {
  "stripe sk_live": "sk_" + "live_" + r("x", 24),
  "stripe sk_test": "sk_" + "test_" + r("A1", 14),
  "stripe rk_live": "rk_" + "live_" + r("b", 30),
  "stripe rk_test": "rk_" + "test_" + r("9", 24),
  "stripe whsec": "whsec" + "_" + r("Z", 32),
  "sourcegraph sgp legacy": "sgp" + "_" + r("a1", 20),
  "sourcegraph sgp instance": "sgp" + "_" + r("f", 16) + "_" + r("0", 40),
  "age secret key": "AGE-" + "SECRET-" + "KEY-1" + ageBody,
  "google api key": "AI" + "za" + r("y", 34) + "_",
  "slack xapp": "xa" + "pp-1-" + "A" + r("B", 9) + "-" + r("1", 12) + "-" + r("c", 32),
  "slack xoxa": "xo" + "xa-2-" + r("4", 12) + "-" + r("k", 12),
};

const negatives: Record<string, string> = {
  "stripe short body": "sk_" + "live_" + r("x", 23),
  "stripe wrong mode": "sk_" + "prod_" + r("x", 24),
  "stripe glued prefix": "mysk_" + "live_" + r("x", 24),
  "whsec short": "whsec" + "_" + r("Z", 31),
  "sgp non-hex": "sgp" + "_" + r("g", 40),
  "sgp short": "sgp" + "_" + r("a", 39),
  "age lowercase": ("AGE-" + "SECRET-" + "KEY-1" + ageBody).toLowerCase(),
  "age bad charset": "AGE-" + "SECRET-" + "KEY-1" + r("B", 58),
  "age short": "AGE-" + "SECRET-" + "KEY-1" + ageBody.slice(0, 57),
  "google 34 chars": "AI" + "za" + r("y", 34),
  "google 36 chars": "AI" + "za" + r("y", 36),
  "google lowercase prefix": "ai" + "za" + r("y", 35),
  "slack xapp malformed": "xa" + "pp-" + r("c", 32),
  "slack xoxa short": "xo" + "xa-2-" + r("4", 5),
};

describe("redactSecrets added patterns", () => {
  for (const [name, secret] of Object.entries(positives)) {
    it(`redacts ${name}`, () => {
      const out = redactSecrets(`before ${secret} after`);
      expect(out).toBe("before [REDACTED] after");
      expect(out).not.toContain(secret);
    });
  }
  for (const [name, value] of Object.entries(negatives)) {
    it(`leaves near-miss ${name}`, () => {
      expect(redactSecrets(`before ${value} after`)).toBe(`before ${value} after`);
    });
  }
  it("keeps ordinary prose untouched", () => {
    const prose = "the sk_live docs, AIza prefix, and xapp tokens are described here";
    expect(redactSecrets(prose)).toBe(prose);
  });
});
