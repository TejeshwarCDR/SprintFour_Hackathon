import React from "react";

/**
 * Signuture Tag — removable keyword chip (skills, roles). Outline style
 * on cream. Pass onRemove to show the dismiss affordance.
 */
export function Tag({ children, onRemove, tone = "blue", style = {} }) {
  const tones = {
    blue: { bg: "var(--blue-100)", fg: "var(--blue-700)", border: "var(--blue-200)" },
    gold: { bg: "var(--gold-100)", fg: "var(--gold-800)", border: "var(--gold-200)" },
    neutral: { bg: "var(--cream-100)", fg: "var(--slate-700)", border: "var(--line-300)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px 5px 12px",
      background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.border}`,
      fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: 500,
      borderRadius: "var(--radius-sm)",
      ...style,
    }}>
      {children}
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove" style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: tones.fg, opacity: 0.6, fontSize: 14, lineHeight: 1, padding: 0,
          display: "inline-flex",
        }}>×</button>
      )}
    </span>
  );
}
