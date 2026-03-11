import { cn, formatDate, truncate, copyToClipboard } from "../../lib/utils";

describe("Utils", () => {
  describe("cn", () => {
    it("joins class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("filters falsy values", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("handles undefined and null", () => {
      expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
    });

    it("returns empty string for no args", () => {
      expect(cn()).toBe("");
    });
  });

  describe("formatDate", () => {
    it("formats ISO date string", () => {
      const result = formatDate("2024-06-15T10:30:00Z");
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("returns fallback for invalid date", () => {
      const result = formatDate("");
      expect(result).toBe("—");
    });

    it("returns fallback for undefined", () => {
      const result = formatDate(undefined as unknown as string);
      expect(result).toBe("—");
    });
  });

  describe("truncate", () => {
    it("truncates long strings", () => {
      const result = truncate("abcdefghijklmnop", 10);
      expect(result.length).toBeLessThanOrEqual(13); // 10 + "..."
      expect(result).toContain("...");
    });

    it("does not truncate short strings", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("handles empty string", () => {
      expect(truncate("", 10)).toBe("");
    });
  });

  describe("copyToClipboard", () => {
    it("calls navigator.clipboard.writeText", async () => {
      const result = await copyToClipboard("test");
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test");
      expect(result).toBe(true);
    });
  });
});
