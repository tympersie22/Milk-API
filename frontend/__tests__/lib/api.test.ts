import { isRateLimited, getRetryAfter, getErrorHint, statusVariant, type ApiEnvelope } from "../../lib/api";

describe("API utilities", () => {
  describe("isRateLimited", () => {
    it("returns true for 429 status", () => {
      const payload: ApiEnvelope = { status: 429, data: {} };
      expect(isRateLimited(payload)).toBe(true);
    });

    it("returns true for RATE_LIMIT_EXCEEDED error code", () => {
      const payload: ApiEnvelope = {
        status: 200,
        data: { error: { code: "RATE_LIMIT_EXCEEDED" } },
      };
      expect(isRateLimited(payload)).toBe(true);
    });

    it("returns false for normal responses", () => {
      const payload: ApiEnvelope = { status: 200, data: {} };
      expect(isRateLimited(payload)).toBe(false);
    });

    it("returns false for null payload", () => {
      expect(isRateLimited(null)).toBe(false);
    });
  });

  describe("getRetryAfter", () => {
    it("returns retry_after from error object", () => {
      const payload: ApiEnvelope = {
        status: 429,
        data: { error: { retry_after: 30 } },
      };
      expect(getRetryAfter(payload)).toBe(30);
    });

    it("returns retry_after from top-level data", () => {
      const payload: ApiEnvelope = {
        status: 429,
        data: { retry_after: 15 },
      };
      expect(getRetryAfter(payload)).toBe(15);
    });

    it("defaults to 60 for null payload", () => {
      expect(getRetryAfter(null)).toBe(60);
    });

    it("defaults to 60 when retry_after is missing", () => {
      const payload: ApiEnvelope = { status: 429, data: {} };
      expect(getRetryAfter(payload)).toBe(60);
    });
  });

  describe("getErrorHint", () => {
    it("returns hint for known error codes", () => {
      const payload: ApiEnvelope = {
        status: 400,
        data: { error: { code: "EMAIL_ALREADY_REGISTERED" } },
      };
      expect(getErrorHint(payload)).toContain("already registered");
    });

    it("returns empty string for success responses", () => {
      const payload: ApiEnvelope = { status: 200, data: {} };
      expect(getErrorHint(payload)).toBe("");
    });

    it("returns fallback for unknown error codes", () => {
      const payload: ApiEnvelope = {
        status: 500,
        data: { error: { code: "UNKNOWN" } },
      };
      expect(getErrorHint(payload)).toContain("Something went wrong");
    });
  });

  describe("statusVariant", () => {
    it("returns success for 2xx", () => {
      expect(statusVariant({ status: 200, data: {} })).toBe("success");
    });

    it("returns warning for 4xx", () => {
      expect(statusVariant({ status: 400, data: {} })).toBe("warning");
    });

    it("returns error for 5xx", () => {
      expect(statusVariant({ status: 500, data: {} })).toBe("error");
    });

    it("returns neutral for null", () => {
      expect(statusVariant(null)).toBe("neutral");
    });
  });
});
