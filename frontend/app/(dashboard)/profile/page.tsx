"use client";

import { useState } from "react";
import { useAuth } from "../../../context/auth-context";
import { apiRequest, type Json } from "../../../lib/api";
import { PageHeader } from "../../../components/layout/page-header";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import { IconUser, IconLock, IconEdit, IconEye, IconEyeOff } from "../../../components/ui/icons";

export default function ProfilePage() {
  const { token, email, name } = useAuth();
  const { toast } = useToast();

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(name);
  const [savingName, setSavingName] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (pw: string): string[] => {
    const errors: string[] = [];
    if (pw.length < 12) errors.push("Must be at least 12 characters");
    if (!/[A-Z]/.test(pw)) errors.push("Must contain an uppercase letter");
    if (!/[a-z]/.test(pw)) errors.push("Must contain a lowercase letter");
    if (!/[0-9]/.test(pw)) errors.push("Must contain a digit");
    if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Must contain a special character");
    return errors;
  };

  const onSaveName = async () => {
    if (!newName.trim()) { toast("Name cannot be empty.", "error"); return; }
    setSavingName(true);
    try {
      const res = await apiRequest("/auth/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        // Update local storage
        const stored = localStorage.getItem("milki_auth");
        if (stored) {
          const data = JSON.parse(stored);
          data.name = newName.trim();
          localStorage.setItem("milki_auth", JSON.stringify(data));
        }
        toast("Name updated successfully!", "success");
        setEditingName(false);
      } else {
        const data = (await res.json()) as Json;
        toast(String((data.error as Json)?.message || data.detail || "Failed to update name."), "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Network error", "error");
    } finally {
      setSavingName(false);
    }
  };

  const onChangePassword = async () => {
    const errors = validatePassword(newPassword);
    setPasswordErrors(errors);
    if (errors.length > 0) return;

    if (newPassword !== confirmPassword) {
      toast("Passwords do not match.", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiRequest("/auth/change-password", {
        method: "POST",
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (res.ok) {
        toast("Password changed successfully!", "success");
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordErrors([]);
      } else {
        const data = (await res.json()) as Json;
        const msg = String((data.error as Json)?.message || data.detail || "Failed to change password.");
        toast(msg, "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Network error", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your account details and security settings."
      />

      {/* Account Info */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2"><IconUser size={16} /> Account Info</h3>
        </div>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="form-group">
            <span className="form-group-label">Display Name</span>
            {editingName ? (
              <div className="flex gap-2 items-center">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Your name"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button size="sm" onClick={onSaveName} loading={savingName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNewName(name); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-medium">{name || "Not set"}</p>
                <Button variant="ghost" size="sm" onClick={() => { setEditingName(true); setNewName(name); }} icon={<IconEdit size={14} />}>
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="form-group">
            <span className="form-group-label">Email</span>
            <p className="font-medium">{email || "Not set"}</p>
          </div>
        </div>
      </Card>

      {/* Password Change */}
      <Card padding="md" className="mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2"><IconLock size={16} /> Security</h3>
          {!showPasswordForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowPasswordForm(true)}>
              Change Password
            </Button>
          )}
        </div>

        {showPasswordForm ? (
          <div className="flex flex-col gap-3 mt-2" style={{ maxWidth: 400 }}>
            {/* Current Password */}
            <label>
              Current Password
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)"
                  }}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </label>

            {/* New Password */}
            <label>
              New Password
              <div style={{ position: "relative" }}>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordErrors(validatePassword(e.target.value)); }}
                  placeholder="Min 12 chars, uppercase, lowercase, digit, special"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)"
                  }}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </label>

            {/* Password strength indicator */}
            {newPassword && (
              <div className="text-sm">
                {passwordErrors.length === 0 ? (
                  <span style={{ color: "var(--color-primary)" }}>Strong password</span>
                ) : (
                  <ul style={{ color: "var(--color-danger)", margin: 0, paddingLeft: 16 }}>
                    {passwordErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Confirm Password */}
            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </label>
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="text-sm" style={{ color: "var(--color-danger)" }}>Passwords do not match</span>
            )}

            <div className="flex gap-2 mt-2">
              <Button
                onClick={onChangePassword}
                loading={savingPassword}
                disabled={!currentPassword || !newPassword || passwordErrors.length > 0 || newPassword !== confirmPassword}
              >
                Update Password
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordErrors([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">
            Your password was set during registration. Click &quot;Change Password&quot; to update it.
          </p>
        )}
      </Card>

      {/* Account Summary */}
      <Card padding="md">
        <h3 className="card-title mb-3">Account Summary</h3>
        <div className="form-row">
          <div className="form-group">
            <span className="form-group-label">Member Since</span>
            <p className="font-medium">
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
            </p>
          </div>
          <div className="form-group">
            <span className="form-group-label">Account Type</span>
            <p className="font-medium">API User</p>
          </div>
        </div>
      </Card>
    </>
  );
}
