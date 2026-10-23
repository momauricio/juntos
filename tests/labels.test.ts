import { describe, expect, it } from "vitest";

import { STATUS_LABELS } from "@/lib/labels";

describe("STATUS_LABELS", () => {
  it("labels want and done", () => {
    expect(STATUS_LABELS.want).toBe("Quero ir");
    expect(STATUS_LABELS.done).toBe("Já fizemos");
  });
});
