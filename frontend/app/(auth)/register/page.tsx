"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { IconMap, IconEye, IconEyeOff } from "../../../components/ui/icons";
import { validateRegisterForm, validatePassword, getPasswordStrength, getPasswordStrengthColor, type ValidationError } from "../../../lib/validation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const getFieldError = (field: string) => fieldErrors.find(e => e.field === field)?.message;
  const pwErrors = password ? validatePassword(password) : [];
  const pwStrength = password ? getPasswordStrength(password) : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const validation = validateRegisterForm(name, email, password);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError(result.error || "Registration failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark"><IconMap size={22} /></div>
          <span className="auth-logo-text">Milki</span>
        </div>

        <Card padding="lg">
          <h2 className="mb-2">Create your account</h2>
          <p className="text-sm text-secondary mb-6">Get started with property intelligence in Tanzania.</p>

          {error && <div className="form-error mb-4">{error}</div>}
          {success && (
            <div className="form-error mb-4" style={{ background: "var(--color-primary-light)", borderColor: "var(--color-primary-border)", color: "#065f46" }}>
              Account created! Redirecting to login...
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label>
              Full Name
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
                aria-invalid={!!getFieldError("name")}
              />
              {getFieldError("name") && (
                <span className="form-field-error">{getFieldError("name")}</span>
              )}
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                aria-invalid={!!getFieldError("email")}
              />
              {getFieldError("email") && (
                <span className="form-field-error">{getFieldError("email")}</span>
              )}
            </label>

            <label>
              Password
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 12 chars, mixed case + number + special"
                  required
                  minLength={12}
                  aria-invalid={!!getFieldError("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--color-text-tertiary)", display: "flex", padding: 4
                  }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {/* Password strength meter */}
              {password && (
                <div className="mt-2">
                  <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                    {["weak", "fair", "good", "strong"].map((level, i) => (
                      <div key={level} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= ["weak", "fair", "good", "strong"].indexOf(pwStrength || "weak")
                          ? getPasswordStrengthColor(pwStrength || "weak")
                          : "var(--color-border)",
                        transition: "background 0.2s",
                      }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: getPasswordStrengthColor(pwStrength || "weak") }}>
                    {pwStrength && pwStrength.charAt(0).toUpperCase() + pwStrength.slice(1)}
                  </span>
                </div>
              )}
              {pwErrors.length > 0 && password && (
                <ul className="form-field-error" style={{ paddingLeft: 16, margin: "4px 0 0" }}>
                  {pwErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </label>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Create Account
            </Button>
          </form>
        </Card>

        <p className="auth-toggle">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
