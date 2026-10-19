import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  MEMBER_TOKEN_FAILURE_CLIENT_CAP,
  memberTokenFailureLimitSizeForTests,
  recordMemberTokenFailure,
  resetMemberTokenFailureLimitForTests,
} from "../lib/forum-member-token-limit";

function requestFrom(ip: string): Request {
  return { ip, socket: {} } as Request;
}

describe("member token failure limiter", () => {
  it("stays within the client cap when many distinct addresses fail", () => {
    resetMemberTokenFailureLimitForTests();
    const now = Date.now();
    const flood = MEMBER_TOKEN_FAILURE_CLIENT_CAP * 4;
    for (let i = 0; i < flood; i += 1) {
      recordMemberTokenFailure(requestFrom(`synthetic-client-${i}`), now);
    }
    expect(memberTokenFailureLimitSizeForTests()).toBe(MEMBER_TOKEN_FAILURE_CLIENT_CAP);
    expect(memberTokenFailureLimitSizeForTests()).toBeLessThan(flood);
  });

  it("keeps the map at the cap across two hundred thousand distinct addresses", () => {
    resetMemberTokenFailureLimitForTests();
    const now = Date.now();
    const flood = 200_000;
    let largest = 0;
    for (let i = 0; i < flood; i += 1) {
      recordMemberTokenFailure(requestFrom(`synthetic-flood-${i}`), now);
      const size = memberTokenFailureLimitSizeForTests();
      if (size > largest) largest = size;
    }
    expect(largest).toBeLessThanOrEqual(MEMBER_TOKEN_FAILURE_CLIENT_CAP);
    expect(memberTokenFailureLimitSizeForTests()).toBe(MEMBER_TOKEN_FAILURE_CLIENT_CAP);
  }, 60_000);
});
