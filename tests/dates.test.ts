import { describe, expect, it } from "vitest";

import { brToIso, isoToBr, maskBrDateInput } from "@/lib/dates";

describe("maskBrDateInput", () => {
  it("keeps day digits as typed (20 stays 20, not month)", () => {
    expect(maskBrDateInput("20")).toBe("20");
    expect(maskBrDateInput("2008")).toBe("20/08");
    expect(maskBrDateInput("20082026")).toBe("20/08/2026");
  });
});

describe("brToIso / isoToBr", () => {
  it("round-trips valid Brazilian dates", () => {
    expect(brToIso("20/08/2026")).toBe("2026-08-20");
    expect(isoToBr("2026-08-20")).toBe("20/08/2026");
  });

  it("rejects impossible calendar dates", () => {
    expect(brToIso("31/02/2026")).toBeNull();
    expect(brToIso("00/01/2026")).toBeNull();
  });
});
