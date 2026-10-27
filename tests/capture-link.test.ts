import { describe, expect, it } from "vitest";

import {
  captureLink,
  normalizeLink,
  originalLink,
  parseLink,
  parseSavedStatus,
  SAVED_DONE_RATING_PROMPT,
  savedRedirectPath,
  savedToastCopy,
} from "@/lib/capture-link";

describe("parseLink", () => {
  it("accepts http(s) links", () => {
    expect(parseLink("  https://example.com/a?b=1 ")).toEqual({
      ok: true,
      url: "https://example.com/a?b=1",
    });
    expect(parseLink("http://example.com")).toEqual({
      ok: true,
      url: "http://example.com/",
    });
  });

  it("adds https:// to domain-looking text", () => {
    expect(parseLink("instagram.com/p/ABC")).toEqual({
      ok: true,
      url: "https://instagram.com/p/ABC",
    });
    expect(parseLink("www.example.com.br")).toEqual({
      ok: true,
      url: "https://www.example.com.br/",
    });
  });

  it("rejects text that is not a link", () => {
    expect(parseLink("")).toEqual({ ok: false, error: "not_a_link" });
    expect(parseLink("   ")).toEqual({ ok: false, error: "not_a_link" });
    expect(parseLink("Café da Esquina")).toEqual({
      ok: false,
      error: "not_a_link",
    });
    expect(parseLink("olha isso instagram.com/p/ABC")).toEqual({
      ok: false,
      error: "not_a_link",
    });
    expect(parseLink("https://")).toEqual({ ok: false, error: "not_a_link" });
  });

  it("rejects schemes other than http(s)", () => {
    expect(parseLink("javascript:alert(1)")).toEqual({
      ok: false,
      error: "not_a_link",
    });
    expect(parseLink("mailto:ana@example.com")).toEqual({
      ok: false,
      error: "not_a_link",
    });
    expect(parseLink("ftp://example.com/file")).toEqual({
      ok: false,
      error: "not_a_link",
    });
  });
});

describe("normalizeLink", () => {
  it("canonicalizes Instagram posts, reels and tv", () => {
    expect(normalizeLink("https://instagram.com/p/ABC123")).toBe(
      "https://www.instagram.com/p/ABC123/",
    );
    expect(normalizeLink("https://www.instagram.com/reel/Xy_z-9/")).toBe(
      "https://www.instagram.com/reel/Xy_z-9/",
    );
    expect(normalizeLink("https://www.instagram.com/tv/TV1")).toBe(
      "https://www.instagram.com/tv/TV1/",
    );
    expect(normalizeLink("https://www.instagram.com/fulano/p/ABC/")).toBe(
      "https://www.instagram.com/p/ABC/",
    );
  });

  it("accepts instagr.am", () => {
    expect(normalizeLink("http://instagr.am/p/ABC")).toBe(
      "https://www.instagram.com/p/ABC/",
    );
  });

  it("drops igsh, utm_* and hash from Instagram posts", () => {
    expect(
      normalizeLink(
        "https://www.instagram.com/p/ABC/?igsh=xyz&utm_source=ig_web_copy_link#c",
      ),
    ).toBe("https://www.instagram.com/p/ABC/");
  });

  it("keeps other links, without hash", () => {
    expect(normalizeLink("https://example.com/menu?dia=1#topo")).toBe(
      "https://example.com/menu?dia=1",
    );
    expect(normalizeLink("https://maps.app.goo.gl/abc")).toBe(
      "https://maps.app.goo.gl/abc",
    );
  });

  it("keeps Instagram profiles as regular links", () => {
    expect(normalizeLink("https://www.instagram.com/fulano/?hl=pt")).toBe(
      "https://www.instagram.com/fulano/?hl=pt",
    );
  });
});

describe("captureLink", () => {
  it("parses and normalizes", () => {
    expect(captureLink("instagram.com/reel/ABC?igsh=1")).toBe(
      "https://www.instagram.com/reel/ABC/",
    );
    expect(captureLink("não é link")).toBeNull();
  });
});

describe("saved toast", () => {
  it("names the column", () => {
    expect(savedToastCopy("want")).toBe("Salvo em Queremos 💛");
    expect(savedToastCopy("done")).toBe("Salvo em Já fizemos 💛");
  });

  it("asks for the rating after saving as done", () => {
    expect(SAVED_DONE_RATING_PROMPT).toBe(
      "Salvo em Já fizemos 💛 Que nota você dá?",
    );
  });

  it("parses the salvo param", () => {
    expect(parseSavedStatus("want")).toBe("want");
    expect(parseSavedStatus(["done", "want"])).toBe("done");
    expect(parseSavedStatus("all")).toBeNull();
    expect(parseSavedStatus(undefined)).toBeNull();
  });
});

describe("savedRedirectPath", () => {
  it("opens the item when saved as done", () => {
    expect(savedRedirectPath("done", "abc-123")).toBe(
      "/items/abc-123?salvo=done",
    );
  });

  it("goes back to the board with the toast when saved as want", () => {
    expect(savedRedirectPath("want", "abc-123")).toBe(
      "/?salvo=want&novo=abc-123",
    );
  });
});

describe("originalLink", () => {
  it("shows host and path without scheme or www", () => {
    expect(
      originalLink("https://www.instagram.com/p/CeramicaExemplo/"),
    ).toEqual({
      href: "https://www.instagram.com/p/CeramicaExemplo/",
      label: "instagram.com/p/CeramicaExemplo/",
    });
  });

  it("drops query, hash and a bare root path from the label", () => {
    expect(originalLink("http://exemplo.com.br/?utm=x#topo")).toEqual({
      href: "http://exemplo.com.br/?utm=x#topo",
      label: "exemplo.com.br",
    });
    expect(originalLink("https://site.com/a/b?igsh=123")?.label).toBe(
      "site.com/a/b",
    );
  });

  it("keeps the port and decodes the path", () => {
    expect(
      originalLink("https://exemplo.com:8080/cer%C3%A2mica")?.label,
    ).toBe("exemplo.com:8080/cerâmica");
  });

  it("links bare domains over https", () => {
    expect(originalLink("  maps.app.goo.gl/abc  ")).toEqual({
      href: "https://maps.app.goo.gl/abc",
      label: "maps.app.goo.gl/abc",
    });
  });

  it("never links non-http text", () => {
    expect(originalLink("javascript:alert(1)")).toEqual({
      href: null,
      label: "javascript:alert(1)",
    });
    expect(originalLink("no ateliê do bairro")).toEqual({
      href: null,
      label: "no ateliê do bairro",
    });
  });

  it("returns null when there is no link", () => {
    expect(originalLink(null)).toBeNull();
    expect(originalLink(undefined)).toBeNull();
    expect(originalLink("   ")).toBeNull();
  });
});
