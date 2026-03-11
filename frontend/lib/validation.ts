/**
 * Form validation utilities
 * Matches backend Pydantic schema constraints
 */

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

// --- Individual validators ---

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  if (email.length > 255) return "Email must be less than 255 characters";
  return null;
}

export function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (!password) { errors.push("Password is required"); return errors; }
  if (password.length < 12) errors.push("Must be at least 12 characters");
  if (password.length > 128) errors.push("Must be less than 128 characters");
  if (!/[A-Z]/.test(password)) errors.push("Must contain an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must contain a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Must contain a digit");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Must contain a special character");
  return errors;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return "Name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  if (name.length > 100) return "Name must be less than 100 characters";
  return null;
}

export function validateTitleNumber(titleNumber: string): string | null {
  if (!titleNumber.trim()) return "Title number is required";
  if (titleNumber.length > 50) return "Title number is too long";
  // Basic format: alphanumeric with dashes
  if (!/^[A-Za-z0-9\-/]+$/.test(titleNumber.trim())) {
    return "Title number can only contain letters, numbers, dashes, and slashes";
  }
  return null;
}

// --- Password strength meter ---

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  const errors = validatePassword(password);
  if (errors.length >= 3) return "weak";
  if (errors.length >= 2) return "fair";
  if (errors.length >= 1) return "good";
  return "strong";
}

export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak": return "var(--color-danger)";
    case "fair": return "var(--color-accent)";
    case "good": return "var(--color-info)";
    case "strong": return "var(--color-primary)";
  }
}

// --- Form-level validators ---

export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: ValidationError[] = [];
  const emailErr = validateEmail(email);
  if (emailErr) errors.push({ field: "email", message: emailErr });
  if (!password) errors.push({ field: "password", message: "Password is required" });
  return { valid: errors.length === 0, errors };
}

export function validateRegisterForm(name: string, email: string, password: string): ValidationResult {
  const errors: ValidationError[] = [];
  const nameErr = validateName(name);
  if (nameErr) errors.push({ field: "name", message: nameErr });
  const emailErr = validateEmail(email);
  if (emailErr) errors.push({ field: "email", message: emailErr });
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) errors.push({ field: "password", message: pwErrors[0] });
  return { valid: errors.length === 0, errors };
}

export function validateSearchForm(titleNumber: string): ValidationResult {
  const errors: ValidationError[] = [];
  const tnErr = validateTitleNumber(titleNumber);
  if (tnErr) errors.push({ field: "titleNumber", message: tnErr });
  return { valid: errors.length === 0, errors };
}
