"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { IconX } from "./icons";
import { Button } from "./button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
};

export function Modal({ open, onClose, title, children, wide, actions }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay animate-fadeIn" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={cn("modal-panel animate-slideUp", wide && "modal-wide")}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close-btn" onClick={onClose} aria-label="Close">
              <IconX size={18} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-footer">{actions}</div>}
      </div>
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
};

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", variant = "primary" }: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-secondary">{message}</p>
    </Modal>
  );
}
