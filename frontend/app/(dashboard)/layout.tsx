"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { Sidebar } from "../../components/layout/sidebar";
import { Topbar } from "../../components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Allow time for localStorage hydration
    const timer = setTimeout(() => setHydrated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  // Show nothing while checking auth to prevent flash
  if (!hydrated || !isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div className="animate-pulse" style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, color: "var(--color-text-tertiary)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius-lg)",
            background: "var(--color-primary)", display: "flex",
            alignItems: "center", justifyContent: "center", color: "white",
            fontSize: 18, fontWeight: 700,
          }}>M</div>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <Topbar onMenuClick={() => setSidebarOpen(prev => !prev)} />
        <main className="dashboard-content animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}
