import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({ open, onClose, title, children, width = 520, style = {} }) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;

    const el = dialogRef.current;
    const focusable = Array.from(el.querySelectorAll(FOCUSABLE));
    if (focusable.length) focusable[0].focus();

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };

    const escape = (e) => { if (e.key === 'Escape') onClose?.(); };

    el.addEventListener('keydown', trap);
    document.addEventListener('keydown', escape);
    return () => {
      el.removeEventListener('keydown', trap);
      document.removeEventListener('keydown', escape);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(14, 22, 38, 0.48)',
        backdropFilter: 'blur(2px)',
        padding: 'var(--space-5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - var(--space-8))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...style,
        }}
      >
        {title && (
          <div style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span id="modal-title" style={{
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: 'var(--fs-body-lg)', color: 'var(--text-primary)',
            }}>
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 20, lineHeight: 1,
                padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)',
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
