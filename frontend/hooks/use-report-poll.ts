"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, type ReportStatus } from "../lib/api";

type ReportStatusUpdate = {
  report_id: string;
  status: ReportStatus;
};

/**
 * Smart polling hook for report status updates.
 * Polls GET /reports/{id} at adaptive intervals:
 *   - 1s for first 10 polls (initial burst)
 *   - 3s for next 20 polls
 *   - 10s thereafter
 * Stops when status is "completed" or "failed".
 */
export function useReportPoll(apiKey: string) {
  const [tracking, setTracking] = useState<Map<string, ReportStatus>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const track = useCallback((reportId: string) => {
    setTracking(prev => {
      const next = new Map(prev);
      next.set(reportId, "processing");
      return next;
    });
    pollCountRef.current = 0;
  }, []);

  const untrack = useCallback((reportId: string) => {
    setTracking(prev => {
      const next = new Map(prev);
      next.delete(reportId);
      return next;
    });
  }, []);

  const pollAll = useCallback(async () => {
    const active = Array.from(tracking.entries()).filter(
      ([, status]) => status === "processing"
    );
    if (active.length === 0) return;

    pollCountRef.current += 1;

    const updates: ReportStatusUpdate[] = [];
    await Promise.allSettled(
      active.map(async ([reportId]) => {
        try {
          const res = await apiRequest(`/reports/${reportId}`, { apiKey, timeoutMs: 10000 });
          if (res.ok) {
            const data = await res.json();
            const status = data.status as ReportStatus;
            if (status && status !== "processing") {
              updates.push({ report_id: reportId, status });
            }
          }
        } catch {
          /* network blip — retry next cycle */
        }
      })
    );

    if (updates.length > 0) {
      setTracking(prev => {
        const next = new Map(prev);
        updates.forEach(u => next.set(u.report_id, u.status));
        return next;
      });
    }
  }, [tracking, apiKey]);

  // Adaptive polling interval
  useEffect(() => {
    const hasActive = Array.from(tracking.values()).some(s => s === "processing");
    if (!hasActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const getInterval = () => {
      if (pollCountRef.current < 10) return 1000;
      if (pollCountRef.current < 30) return 3000;
      return 10000;
    };

    // Clear old interval
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(pollAll, getInterval());

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tracking, pollAll]);

  return { tracking, track, untrack };
}
