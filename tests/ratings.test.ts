import { describe, expect, it } from "vitest";
import {
  assertScore,
  coupleScore,
  displayRating,
  formatScore,
  personAverage,
  restaurantAverage,
} from "@/lib/ratings";

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

const restaurant = (food: number, service: number, ambiance: number) => ({
  food,
  service,
  ambiance,
  score: null,
});
const standard = (score: number) => ({
  food: null,
  service: null,
  ambiance: null,
  score,
});

describe("personAverage", () => {
  it("does not round the restaurant average", () => {
    expect(personAverage(restaurant(9, 8, 9))).toBeCloseTo(26 / 3);
    expect(formatScore(personAverage(restaurant(9, 8, 9))!)).toBe("8,7");
    expect(formatScore(personAverage(restaurant(9, 7, 8))!)).toBe("8,0");
  });

  it("returns the standard score", () => {
    expect(personAverage(standard(7))).toBe(7);
  });
});

describe("coupleScore", () => {
  it("returns null without ratings", () => {
    expect(coupleScore([])).toBeNull();
    expect(
      coupleScore([{ food: null, service: null, ambiance: null, score: null }]),
    ).toBeNull();
  });

  it("uses the only rating when one person rated", () => {
    expect(coupleScore([restaurant(9, 8, 9)])).toBe(8.7);
    expect(coupleScore([standard(7)])).toBe(7);
  });

  it("averages unrounded restaurant averages of two people", () => {
    expect(coupleScore([restaurant(9, 8, 9), restaurant(9, 7, 8)])).toBe(8.3);
    expect(formatScore(coupleScore([restaurant(9, 8, 9), restaurant(9, 7, 8)])!)).toBe(
      "8,3",
    );
  });

  it("averages standard scores of two people", () => {
    expect(coupleScore([standard(7), standard(10)])).toBe(8.5);
  });
});

describe("formatScore", () => {
  it("always shows one decimal in pt-BR", () => {
    expect(formatScore(8.3)).toBe("8,3");
    expect(formatScore(8)).toBe("8,0");
    expect(formatScore(10)).toBe("10,0");
  });
});
