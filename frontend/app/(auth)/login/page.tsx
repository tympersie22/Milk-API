"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { IconMap, IconEye, IconEyeOff } from "../../../components/ui/icons";
import { validateLoginForm, type ValidationError } from "../../../lib/validation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const getFieldError = (field: string) => fieldErrors.find(e => e.field === field)?.message;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const validation = validateLoginForm(email, password);
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error || "Login failed");
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
          <h2 className="mb-2">Welcome back</h2>
          <p className="text-sm text-secondary mb-6">Sign in to your property intelligence dashboard.</p>

          {error && <div className="form-error mb-4">{error}</div>}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                aria-invalid={!!getFieldError("email")}
                aria-describedby={getFieldError("email") ? "email-error" : undefined}
              />
              {getFieldError("email") && (
                <span id="email-error" className="form-field-error">{getFieldError("email")}</span>
              )}
            </label>

            <label>
              Password
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
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
                >
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </label>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign In
            </Button>
          </form>
        </Card>

        <p className="auth-toggle">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
