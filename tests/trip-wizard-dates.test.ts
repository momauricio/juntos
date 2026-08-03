import { describe, expect, it } from "vitest";

import { destinationDateError } from "@/lib/dates";

describe("destinationDateError", () => {
  it("allows next destination to start on previous end day", () => {
    expect(
      destinationDateError(
        [
          { name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
          { name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
        ],
        1,
      ),
    ).toBeNull();
  });

  it("rejects next destination starting inside previous range", () => {
    const message = destinationDateError(
      [
        { name: "Santiago", startDate: "2026-08-03", endDate: "2026-08-10" },
        { name: "Bolivia", startDate: "2026-08-07", endDate: "2026-08-19" },
      ],
      1,
    );
    expect(message).toMatch(/meio de Santiago/);
    expect(message).toMatch(/10\/08\/2026/);
  });
});
