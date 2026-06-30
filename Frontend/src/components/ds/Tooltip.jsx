import React, { useId, useState } from "react";

// Keyboard-accessible tooltip: activates on hover OR focus.
// tabIndex={0} on the wrapper makes non-interactive children tab-reachable.
export function Tooltip({ children, content, placement = "top" }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  if (!content) return <>{children}</>;

  const verticalStyle =
    placement === "bottom"
      ? { top: "calc(100% + 7px)" }
      : { bottom: "calc(100% + 7px)" };

  return (
    <span
      tabIndex={0}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", outline: "none" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            ...verticalStyle,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2937",
            color: "#f9fafb",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            lineHeight: "1.55",
            width: 260,
            zIndex: 9999,
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            textAlign: "left",
            whiteSpace: "normal",
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
