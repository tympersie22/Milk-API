"use client";

import Link from "next/link";
import { Button } from "../components/ui/button";
import { IconHome, IconMap } from "../components/ui/icons";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "var(--color-bg)",
    }}>
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "var(--radius-xl)",
          background: "var(--color-primary-light)", color: "var(--color-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <IconMap size={32} />
        </div>

        <h1 style={{ fontSize: "4rem", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8 }}>
          404
        </h1>
        <h2 style={{ marginBottom: 8 }}>Page not found</h2>
        <p className="text-secondary" style={{ marginBottom: 32 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link href="/">
          <Button icon={<IconHome size={16} />}>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
