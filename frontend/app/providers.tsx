"use client";

import { AuthProvider } from "../context/auth-context";
import { ThemeProvider } from "../context/theme-context";
import { ToastProvider } from "../components/ui/toast";
import { ErrorBoundary } from "../components/ui/error-boundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
