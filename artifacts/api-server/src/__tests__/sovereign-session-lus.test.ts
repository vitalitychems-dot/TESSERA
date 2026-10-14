import { afterEach, describe, expect, it } from "vitest";
import { lusDecodeCredential, lusEncodeCredential } from "../lib/lingua-universalis";
import { verifyAdminToken } from "../lib/sovereign-session";

const originalKey = process.env.TESSERACT_ADMIN_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = originalKey;
});

describe("single Father credential in raw or LUS form", () => {
  it("accepts the same credential in the LUS glyph form", () => {
    const syntheticCredential = "synthetic-test-only-owner-code-7A91";
    process.env.TESSERACT_ADMIN_KEY = syntheticCredential;
    const glyphForm = lusEncodeCredential(syntheticCredential);

    expect(verifyAdminToken(syntheticCredential)).toBe(true);
    expect(lusDecodeCredential(glyphForm)).toBe(syntheticCredential);
    expect(verifyAdminToken(glyphForm)).toBe(true);
    expect(lusDecodeCredential(`${glyphForm}\u02d9`)).toBeNull();
  });

  it("still rejects a different code and refuses an unset credential", () => {
    process.env.TESSERACT_ADMIN_KEY = "synthetic-test-only-owner-code-7A91";
    expect(verifyAdminToken(lusEncodeCredential("synthetic-test-only-other-code-19B2"))).toBe(false);

    delete process.env.TESSERACT_ADMIN_KEY;
    expect(verifyAdminToken("synthetic-test-only-owner-code-7A91")).toBe(false);
  });
});
