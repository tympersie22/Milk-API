"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";
import { IconAlertTriangle } from "./icons";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          padding: 40,
          textAlign: "center",
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "var(--radius-lg)",
            background: "var(--color-danger-light)", color: "var(--color-danger)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconAlertTriangle size={24} />
          </div>
          <h3>Something went wrong</h3>
          <p className="text-sm text-secondary" style={{ maxWidth: 400 }}>
            An unexpected error occurred. Try refreshing the page or navigating back.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: "0.75rem", color: "var(--color-danger)",
              background: "var(--color-danger-light)", padding: "8px 12px",
              borderRadius: "var(--radius-sm)", maxWidth: "100%", overflow: "auto",
            }}>
              {this.state.error.message}
            </pre>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
