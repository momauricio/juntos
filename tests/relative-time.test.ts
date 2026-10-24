import { describe, expect, it } from "vitest";

import {
  addedByLabel,
  editedByLabel,
  formatRelativeTime,
} from "@/lib/relative-time";

const now = new Date("2026-10-21T15:00:00-03:00");

function ago(ms: number) {
  return new Date(now.getTime() - ms).toISOString();
}

describe("formatRelativeTime", () => {
  it("shows agora for less than a minute or future dates", () => {
    expect(formatRelativeTime(ago(30 * 1000), now)).toBe("agora");
    expect(formatRelativeTime(ago(-5 * 60 * 1000), now)).toBe("agora");
  });

  it("shows minutes and hours within the same day", () => {
    expect(formatRelativeTime(ago(5 * 60 * 1000), now)).toBe("há 5 min");
    expect(formatRelativeTime(ago(3 * 60 * 60 * 1000), now)).toBe("há 3 h");
  });

  it("shows ontem for the previous calendar day in São Paulo", () => {
    expect(formatRelativeTime("2026-10-20T22:00:00-03:00", now)).toBe("ontem");
  });

  it("shows dd/mm for older dates and dd/mm/aaaa for other years", () => {
    expect(formatRelativeTime("2026-10-12T10:00:00-03:00", now)).toBe("12/10");
    expect(formatRelativeTime("2025-12-31T10:00:00-03:00", now)).toBe(
      "31/12/2025",
    );
  });
});

describe("addedByLabel", () => {
  it("combines name and relative time", () => {
    expect(addedByLabel("Ana", ago(30 * 1000), now)).toBe(
      "Ana adicionou · agora",
    );
  });
});

describe("editedByLabel", () => {
  const names = { a: "A", b: "B" };
  const createdAt = ago(10 * 60 * 1000);

  it("returns null when the creator never edited", () => {
    expect(
      editedByLabel(
        {
          created_by: "a",
          updated_by: "a",
          created_at: createdAt,
          updated_at: createdAt,
        },
        names,
        now,
      ),
    ).toBeNull();
  });

  it("shows the creator when they edited more than a minute later", () => {
    expect(
      editedByLabel(
        {
          created_by: "a",
          updated_by: "a",
          created_at: createdAt,
          updated_at: ago(8 * 60 * 1000),
        },
        names,
        now,
      ),
    ).toBe("Editado por A · há 8 min");
  });

  it("shows another editor even right after creation", () => {
    expect(
      editedByLabel(
        {
          created_by: "a",
          updated_by: "b",
          created_at: ago(1000),
          updated_at: now.toISOString(),
        },
        new Map(Object.entries(names)),
        now,
      ),
    ).toBe("Editado por B · agora");
  });

  it("returns null without updated_by", () => {
    expect(
      editedByLabel(
        {
          created_by: "a",
          updated_by: null,
          created_at: createdAt,
          updated_at: now.toISOString(),
        },
        names,
        now,
      ),
    ).toBeNull();
  });

  it("falls back to Pessoa do espaço for unknown editors", () => {
    expect(
      editedByLabel(
        {
          created_by: "a",
          updated_by: "zzz",
          created_at: ago(1000),
          updated_at: now.toISOString(),
        },
        names,
        now,
      ),
    ).toBe("Editado por Pessoa do espaço · agora");
  });
});
