import { describe, expect, it } from "vitest";

import {
  OTP_EXPIRY_SECONDS,
  formatCountdown,
  isValidEmail,
  isValidOtpCode,
  normalizeOtpCode,
  otpDigitsFromInput,
  otpSendErrorKind,
  otpVerifyErrorKind,
  retryAfterSeconds,
  waitMessage,
} from "@/lib/otp";

const EXPIRED_OR_INVALID = {
  name: "AuthApiError",
  status: 403,
  code: "otp_expired",
  message: "Token has expired or is invalid",
};

describe("isValidEmail", () => {
  it("accepts complete addresses", () => {
    expect(isValidEmail("voce@email.com")).toBe(true);
    expect(isValidEmail("  Ana.Souza+juntos@mail.com.br ")).toBe(true);
  });

  it("rejects incomplete addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("voce")).toBe(false);
    expect(isValidEmail("voce@")).toBe(false);
    expect(isValidEmail("voce@email")).toBe(false);
    expect(isValidEmail("voce@email.c")).toBe(false);
    expect(isValidEmail("vo ce@email.com")).toBe(false);
  });
});

describe("OTP code", () => {
  it("normalizes pasted codes with spaces or dashes", () => {
    expect(normalizeOtpCode("123 456")).toBe("123456");
    expect(normalizeOtpCode("123-456")).toBe("123456");
    expect(normalizeOtpCode(" 12 34 56\n")).toBe("123456");
  });

  it("accepts exactly 6 digits", () => {
    expect(isValidOtpCode("123456")).toBe(true);
    expect(isValidOtpCode("123 456")).toBe(true);
    expect(isValidOtpCode("12345")).toBe(false);
    expect(isValidOtpCode("1234567")).toBe(false);
    expect(isValidOtpCode("12a456")).toBe(false);
  });

  it("extracts digits from paste/autofill", () => {
    expect(otpDigitsFromInput("123-456")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(otpDigitsFromInput("12345678")).toHaveLength(6);
    expect(otpDigitsFromInput("7")).toEqual(["7"]);
    expect(otpDigitsFromInput("abc")).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats as m:ss", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(42)).toBe("0:42");
    expect(formatCountdown(5)).toBe("0:05");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-3)).toBe("0:00");
    expect(formatCountdown(4.2)).toBe("0:05");
  });

  it("builds the wait message", () => {
    expect(waitMessage(42)).toBe(
      "Calma que já mandamos! Dá pra pedir outro em 0:42.",
    );
  });
});

describe("retryAfterSeconds", () => {
  it("reads the seconds from the Supabase message", () => {
    expect(
      retryAfterSeconds({
        message: "For security purposes, you can only request this after 42 seconds.",
      }),
    ).toBe(42);
  });

  it("returns null when there is no hint", () => {
    expect(retryAfterSeconds({ message: "Email rate limit exceeded" })).toBeNull();
  });
});

describe("otpSendErrorKind", () => {
  it("maps resend-too-soon to aguarde", () => {
    expect(
      otpSendErrorKind({
        status: 429,
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 30 seconds.",
      }),
    ).toBe("aguarde");
    expect(
      otpSendErrorKind({ status: 429, code: "over_email_send_rate_limit" }),
    ).toBe("aguarde");
  });

  it("maps other 429s to muitas_tentativas", () => {
    expect(
      otpSendErrorKind({ status: 429, code: "over_request_rate_limit" }),
    ).toBe("muitas_tentativas");
  });

  it("maps invalid e-mail errors", () => {
    expect(
      otpSendErrorKind({ status: 400, code: "email_address_invalid" }),
    ).toBe("email_invalido");
  });

  it("maps fetch failures to offline", () => {
    expect(
      otpSendErrorKind({ name: "AuthRetryableFetchError", status: 0 }),
    ).toBe("offline");
    expect(otpSendErrorKind(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("falls back to desconhecido", () => {
    expect(otpSendErrorKind({ status: 500, message: "boom" })).toBe("desconhecido");
  });
});

describe("otpVerifyErrorKind", () => {
  it("treats the generic token error as a wrong code shortly after sending", () => {
    expect(
      otpVerifyErrorKind(EXPIRED_OR_INVALID, { secondsSinceSent: 30 }),
    ).toBe("codigo_errado");
  });

  it("treats the generic token error as expired after the expiry window", () => {
    expect(
      otpVerifyErrorKind(EXPIRED_OR_INVALID, {
        secondsSinceSent: OTP_EXPIRY_SECONDS + 1,
      }),
    ).toBe("codigo_expirado");
  });

  it("prefers wrong code when the send time is unknown", () => {
    expect(
      otpVerifyErrorKind(EXPIRED_OR_INVALID, { secondsSinceSent: null }),
    ).toBe("codigo_errado");
  });

  it("trusts an explicit expired message", () => {
    expect(
      otpVerifyErrorKind(
        { status: 403, code: "otp_expired", message: "Token has expired" },
        { secondsSinceSent: 10 },
      ),
    ).toBe("codigo_expirado");
  });

  it("maps 429 to muitas_tentativas", () => {
    expect(
      otpVerifyErrorKind(
        { status: 429, code: "over_request_rate_limit" },
        { secondsSinceSent: 10 },
      ),
    ).toBe("muitas_tentativas");
  });

  it("maps fetch failures to offline", () => {
    expect(
      otpVerifyErrorKind(
        { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" },
        { secondsSinceSent: 10 },
      ),
    ).toBe("offline");
  });

  it("falls back to desconhecido for server errors", () => {
    expect(
      otpVerifyErrorKind({ status: 500, message: "boom" }, { secondsSinceSent: 10 }),
    ).toBe("desconhecido");
  });
});
