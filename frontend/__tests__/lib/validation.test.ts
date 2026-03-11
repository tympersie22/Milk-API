import {
  validateEmail,
  validatePassword,
  validateName,
  validateTitleNumber,
  getPasswordStrength,
  validateLoginForm,
  validateRegisterForm,
} from "../../lib/validation";

describe("Validation", () => {
  describe("validateEmail", () => {
    it("accepts valid email", () => {
      expect(validateEmail("user@example.com")).toBeNull();
    });

    it("rejects empty email", () => {
      expect(validateEmail("")).toBeTruthy();
    });

    it("rejects invalid email", () => {
      expect(validateEmail("notanemail")).toBeTruthy();
    });

    it("rejects email without domain", () => {
      expect(validateEmail("user@")).toBeTruthy();
    });
  });

  describe("validatePassword", () => {
    it("accepts strong password", () => {
      expect(validatePassword("MyP@ssw0rd123")).toHaveLength(0);
    });

    it("rejects short password", () => {
      const errors = validatePassword("Short1!");
      expect(errors.some(e => e.includes("12 characters"))).toBe(true);
    });

    it("rejects missing uppercase", () => {
      const errors = validatePassword("myp@ssw0rd123");
      expect(errors.some(e => e.includes("uppercase"))).toBe(true);
    });

    it("rejects missing lowercase", () => {
      const errors = validatePassword("MYP@SSW0RD123");
      expect(errors.some(e => e.includes("lowercase"))).toBe(true);
    });

    it("rejects missing digit", () => {
      const errors = validatePassword("MyP@sswordsss");
      expect(errors.some(e => e.includes("digit"))).toBe(true);
    });

    it("rejects missing special character", () => {
      const errors = validatePassword("MyPassword1234");
      expect(errors.some(e => e.includes("special"))).toBe(true);
    });
  });

  describe("validateName", () => {
    it("accepts valid name", () => {
      expect(validateName("John Doe")).toBeNull();
    });

    it("rejects empty name", () => {
      expect(validateName("")).toBeTruthy();
    });

    it("rejects single character", () => {
      expect(validateName("J")).toBeTruthy();
    });
  });

  describe("validateTitleNumber", () => {
    it("accepts valid title number", () => {
      expect(validateTitleNumber("ZNZ-NGW-0001")).toBeNull();
    });

    it("rejects empty title", () => {
      expect(validateTitleNumber("")).toBeTruthy();
    });

    it("rejects special characters", () => {
      expect(validateTitleNumber("ZNZ@001")).toBeTruthy();
    });
  });

  describe("getPasswordStrength", () => {
    it("returns weak for bad passwords", () => {
      expect(getPasswordStrength("abc")).toBe("weak");
    });

    it("returns strong for good passwords", () => {
      expect(getPasswordStrength("MyP@ssw0rd123")).toBe("strong");
    });
  });

  describe("validateLoginForm", () => {
    it("validates correct form", () => {
      const result = validateLoginForm("user@test.com", "password");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("catches empty email", () => {
      const result = validateLoginForm("", "password");
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === "email")).toBe(true);
    });
  });

  describe("validateRegisterForm", () => {
    it("validates correct form", () => {
      const result = validateRegisterForm("John", "john@test.com", "MyP@ssw0rd123");
      expect(result.valid).toBe(true);
    });

    it("catches all errors", () => {
      const result = validateRegisterForm("", "bad", "weak");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
