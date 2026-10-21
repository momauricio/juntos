import { describe, expect, it } from "vitest";
import { assertScore, displayRating, restaurantAverage } from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(10, 8, 8)).toBe(8.7);
    expect(restaurantAverage(10, 10, 10)).toBe(10);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
    expect(restaurantAverage(9, 10, 6)).toBe(8.3);
  });
});

describe("assertScore", () => {
  it("accepts integers 1 through 10", () => {
    for (let n = 1; n <= 10; n++) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and non-integers", () => {
    expect(() => assertScore(0)).toThrow(/1 a 10/);
    expect(() => assertScore(11)).toThrow(/1 a 10/);
    expect(() => assertScore(-1)).toThrow(/1 a 10/);
    expect(() => assertScore(Number.NaN)).toThrow(/1 a 10/);
    expect(() => assertScore(3.5)).toThrow();
  });
});

describe("displayRating", () => {
  it("averages restaurant ratings on the 1–10 scale", () => {
    const value = displayRating({ food: 9, service: 10, ambiance: 6, score: null });
    expect(value).toBe(8.3);
    // Same formatting as ratingLabel in components/item-list.tsx.
    expect(
      `Nota ${value!.toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })}`,
    ).toBe("Nota 8,3");
  });

  it("returns the standard score up to 10", () => {
    expect(
      displayRating({ food: null, service: null, ambiance: null, score: 10 }),
    ).toBe(10);
  });
});
