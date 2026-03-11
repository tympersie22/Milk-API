"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { Sidebar } from "../../components/layout/sidebar";
import { Topbar } from "../../components/layout/topbar";
import { Skeleton } from "../../components/ui/skeleton";

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
      <div className="dashboard-shell">
        <div className="sidebar" />
        <div className="dashboard-main">
          <div className="topbar" />
          <main className="dashboard-content">
            <Skeleton width="240px" height="32px" className="mb-2" />
            <Skeleton width="380px" height="14px" className="mb-6" />
            <div className="stat-grid">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} width="100%" height="120px" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <Topbar onMenuClick={() => setSidebarOpen(prev => !prev)} />
        <main id="main-content" className="dashboard-content animate-fadeIn" role="main" aria-label="Dashboard content">
          {children}
        </main>
      </div>
    </div>
  );
}
