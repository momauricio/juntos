import { describe, expect, it } from "vitest";
import {
  assertScore,
  coupleScore,
  displayRating,
  formatScore,
  parseScore,
  personAverage,
  restaurantAverage,
  SCORE_ERROR,
  scoreInputValue,
} from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(10, 8, 8)).toBe(8.7);
    expect(restaurantAverage(10, 10, 10)).toBe(10);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
    expect(restaurantAverage(9, 10, 6)).toBe(8.3);
  });

  it("averages decimal scores and rounds only at the end", () => {
    expect(restaurantAverage(8.2, 9.3, 7.5)).toBe(8.3);
    expect(restaurantAverage(8.1, 8.1, 8.2)).toBe(8.1);
    expect(restaurantAverage(9.9, 9.9, 10)).toBe(9.9);
  });
});

describe("assertScore", () => {
  it("accepts 1 through 10 with up to one decimal", () => {
    for (let n = 1; n <= 10; n++) {
      expect(() => assertScore(n)).not.toThrow();
    }
    for (const n of [1.1, 3.5, 8.2, 9.3, 9.9, 0.1 + 0.7 + 7.4]) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and more than one decimal", () => {
    for (const n of [0, 0.9, 10.1, 11, -1, Number.NaN, Number.POSITIVE_INFINITY, 8.25, 3.333]) {
      expect(() => assertScore(n)).toThrow(SCORE_ERROR);
    }
  });
});

describe("parseScore", () => {
  it("accepts comma, dot and integers", () => {
    expect(parseScore("8,2")).toBe(8.2);
    expect(parseScore("8.2")).toBe(8.2);
    expect(parseScore("8")).toBe(8);
    expect(parseScore(" 9,3 ")).toBe(9.3);
    expect(parseScore("1")).toBe(1);
    expect(parseScore("10")).toBe(10);
    expect(parseScore("10,0")).toBe(10);
    expect(parseScore("8,0")).toBe(8);
  });

  it("rejects more than one decimal, out of range and empty", () => {
    for (const text of ["8,25", "0,9", "0", "10,1", "11", "", "  ", "abc", "8,", ",5", "8,2,1", "-1", "1e1", "08"]) {
      expect(() => parseScore(text)).toThrow(SCORE_ERROR);
    }
  });

  it("uses the agreed message", () => {
    expect(SCORE_ERROR).toBe("Nota deve ser de 1 a 10, com até 1 casa (ex.: 8,2)");
  });
});

describe("scoreInputValue", () => {
  it("shows the saved score with comma and one decimal", () => {
    expect(scoreInputValue(8)).toBe("8,0");
    expect(scoreInputValue(8.2)).toBe("8,2");
    expect(scoreInputValue(null)).toBe("");
    expect(scoreInputValue(undefined)).toBe("");
    expect(parseScore(scoreInputValue(10))).toBe(10);
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

  it("averages decimal scores without float drift at the half", () => {
    expect(coupleScore([standard(8.2), standard(8.3)])).toBe(8.3);
    expect(coupleScore([standard(0.1 + 0.2 + 8), standard(8.4)])).toBe(8.4);
    expect(coupleScore([restaurant(8.2, 9.3, 7.5), restaurant(9, 7, 8)])).toBe(8.2);
    expect(formatScore(coupleScore([restaurant(8.2, 9.3, 7.5), standard(8.6)])!)).toBe(
      "8,5",
    );
  });
});

describe("formatScore", () => {
  it("always shows one decimal in pt-BR", () => {
    expect(formatScore(8.3)).toBe("8,3");
    expect(formatScore(8)).toBe("8,0");
    expect(formatScore(10)).toBe("10,0");
    expect(formatScore(8.2)).toBe("8,2");
  });
});
