import { describe, expect, it } from "vitest";

import {
  dayNumberFromTripDate,
  destinationDateError,
  tripDateFromDayNumber,
} from "@/lib/dates";

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

describe("trip day <-> calendar date", () => {
  it("maps day 1 to trip start and day 3 to two days later", () => {
    expect(tripDateFromDayNumber("2026-08-04", 1)).toBe("2026-08-04");
    expect(tripDateFromDayNumber("2026-08-04", 3)).toBe("2026-08-06");
  });

  it("maps calendar date back to day number", () => {
    expect(dayNumberFromTripDate("2026-08-04", "2026-08-04")).toBe(1);
    expect(dayNumberFromTripDate("2026-08-04", "2026-08-15")).toBe(12);
    expect(dayNumberFromTripDate("2026-08-04", "2026-08-03")).toBeNull();
  });
});
