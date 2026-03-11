"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { IconCheck, IconX, IconAlertTriangle } from "./icons";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={cn("toast-item", `toast-${t.type}`)}>
            <span className="toast-icon">
              {t.type === "success" ? <IconCheck size={16} /> : t.type === "error" ? <IconAlertTriangle size={16} /> : null}
            </span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-dismiss" onClick={() => dismiss(t.id)}><IconX size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
