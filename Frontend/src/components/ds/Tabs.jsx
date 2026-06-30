import React from "react";

/**
 * Signuture Tabs — underline tabs with a gold active indicator.
 * Controlled via value/onChange; items are [{ id, label }].
 */
export function Tabs({ items = [], value, onChange, style = {} }) {
  const active = value ?? (items[0] && items[0].id);
  return (
    <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1.5px solid var(--line-300)", ...style }}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange && onChange(it.id)}
            style={{
              position: "relative",
              border: "none",
              background: "transparent",
              padding: "10px 14px 12px",
              fontFamily: "var(--font-body)",
              fontSize: "0.9375rem",
              fontWeight: on ? 700 : 500,
              color: on ? "var(--blue-900)" : "var(--slate-500)",
              cursor: "pointer",
              transition: "color var(--dur-fast) var(--ease-standard)",
            }}
          >
            {it.label}
            <span style={{
              position: "absolute", left: 8, right: 8, bottom: -1.5, height: 3,
              borderRadius: "var(--radius-pill)",
              background: on ? "var(--gold-500)" : "transparent",
              transition: "background var(--dur-fast) var(--ease-standard)",
            }} />
          </button>
        );
      })}
    </div>
  );
}
