import { describe, expect, it } from "vitest";
import { ratingAutoOpenKey, shouldAutoOpen } from "@/lib/rating-auto-open";

describe("shouldAutoOpen", () => {
  it("opens when the item is done and I have not rated yet", () => {
    expect(
      shouldAutoOpen({
        status: "done",
        hasMyRating: false,
        alreadyOpened: false,
      }),
    ).toBe(true);
  });

  it("does not open again after the first time", () => {
    expect(
      shouldAutoOpen({
        status: "done",
        hasMyRating: false,
        alreadyOpened: true,
      }),
    ).toBe(false);
  });

  it("does not open when I already rated", () => {
    expect(
      shouldAutoOpen({
        status: "done",
        hasMyRating: true,
        alreadyOpened: false,
      }),
    ).toBe(false);
  });

  it("does not open for items we still want to do", () => {
    expect(
      shouldAutoOpen({
        status: "want",
        hasMyRating: false,
        alreadyOpened: false,
      }),
    ).toBe(false);
  });
});

describe("ratingAutoOpenKey", () => {
  it("scopes the key by user and item", () => {
    expect(ratingAutoOpenKey("user-1", "item-1")).toBe(
      "juntos:nota-auto-aberta:user-1:item-1",
    );
    expect(ratingAutoOpenKey("user-2", "item-1")).not.toBe(
      ratingAutoOpenKey("user-1", "item-1"),
    );
  });
});
