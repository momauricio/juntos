import { describe, expect, it } from "vitest";
import { assertScore, restaurantAverage } from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(10, 8, 8)).toBe(8.7);
    expect(restaurantAverage(10, 10, 10)).toBe(10);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
  });
});

describe("assertScore", () => {
  it("accepts integers 1 through 10", () => {
    for (const n of [1, 5, 10]) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and non-integers", () => {
    expect(() => assertScore(0)).toThrow(/1 a 10/);
    expect(() => assertScore(11)).toThrow(/1 a 10/);
    expect(() => assertScore(3.5)).toThrow();
  });
});
