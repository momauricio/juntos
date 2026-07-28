import { describe, expect, it } from "vitest";
import { assertScore, restaurantAverage } from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(5, 4, 4)).toBe(4.3);
    expect(restaurantAverage(5, 5, 5)).toBe(5);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
  });
});

describe("assertScore", () => {
  it("accepts integers 1 through 5", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and non-integers", () => {
    expect(() => assertScore(0)).toThrow();
    expect(() => assertScore(6)).toThrow();
    expect(() => assertScore(3.5)).toThrow();
  });
});
