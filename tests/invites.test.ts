import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  inviteExpiresAt,
  isInviteExpired,
} from "@/lib/invites";

describe("generateInviteCode", () => {
  it("returns 8 chars from safe alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("produces varied codes", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(set.size).toBeGreaterThan(10);
  });
});

describe("invite expiry", () => {
  it("expires in 7 days", () => {
    const from = new Date("2026-07-28T12:00:00.000Z");
    const exp = inviteExpiresAt(from);
    expect(exp.toISOString()).toBe("2026-08-04T12:00:00.000Z");
  });

  it("detects expired invites", () => {
    expect(isInviteExpired("2026-07-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      true,
    );
    expect(isInviteExpired("2026-08-01T00:00:00.000Z", new Date("2026-07-28"))).toBe(
      false,
    );
  });
});
