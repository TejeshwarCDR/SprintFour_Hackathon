import React from "react";

/**
 * Signuture Card — warm paper surface. Variants: default (cream, hairline),
 * raised (white + shadow), seal (gold top accent for "signed"/premium).
 */
export function Card({
  variant = "default",
  interactive = false,
  padding = "var(--space-5)",
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const base = {
    default: { background: "var(--cream-50)", border: "1.5px solid var(--line-300)", shadow: "var(--shadow-xs)" },
    raised:  { background: "var(--surface-raised)", border: "1px solid var(--line-200)", shadow: "var(--shadow-md)" },
    seal:    { background: "var(--surface-raised)", border: "1px solid var(--gold-200)", shadow: "var(--shadow-sm)" },
  }[variant];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: base.background,
        border: base.border,
        borderRadius: "var(--radius-lg)",
        boxShadow: interactive && hover ? "var(--shadow-lg)" : base.shadow,
        padding,
        transform: interactive && hover ? "translateY(-2px)" : "none",
        transition: "box-shadow var(--dur-normal) var(--ease-standard), transform var(--dur-normal) var(--ease-standard)",
        cursor: interactive ? "pointer" : "default",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {variant === "seal" && (
        <span style={{ position: "absolute", insetInline: 0, top: 0, height: 4, background: "linear-gradient(90deg, var(--gold-400), var(--gold-600))" }} />
      )}
      {children}
    </div>
  );
}
