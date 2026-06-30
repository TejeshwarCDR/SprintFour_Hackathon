import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Lock, ArrowLeft } from "lucide-react";
import { Button } from "../components/ds/Button.jsx";
import { Card } from "../components/ds/Card.jsx";
import { Badge } from "../components/ds/Badge.jsx";
import { spanBadgeTone } from "../lib/spanUtils.js";

export function CommitScreen({ doc, summary, preCheckedToAccept = [], onBack, onCommit }) {
  const [confirming, setConfirming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const headingRef = useRef(null);

  // Move focus to the heading on mount so screen readers announce the view.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Pre-checked spans are still status "pending" here (accept fires inside onCommit,
  // after the user confirms), so exclude them from the "unreviewed" counts — they're
  // handled separately in the summary row below.
  const preCheckedIds = new Set(preCheckedToAccept.map((s) => s.id));
  const unresolved = doc.spans.filter((s) => s.status === "pending" && !preCheckedIds.has(s.id));
  const highRiskUnresolved = unresolved.filter((s) => s.riskTier === "high");
  const conflictedUnresolved = unresolved.filter((s) => s.conflict);
  const accepted = doc.spans.filter((s) => s.status === "accepted");
  const rejected = doc.spans.filter((s) => s.status === "rejected");

  const hasUnresolved = unresolved.length > 0;

  const handleCommit = async () => {
    setCommitting(true);
    setError(null);
    try {
      await onCommit();
    } catch (e) {
      setError(e.message);
      setCommitting(false);
      setConfirming(false);
    }
  };

  return (
    <div
      role="main"
      aria-labelledby="commit-heading"
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "var(--space-4) var(--space-6)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
      }}>
        <button
          onClick={onBack}
          disabled={committing}
          style={{
            border: "none", background: "none", cursor: committing ? "not-allowed" : "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            gap: "var(--space-2)", padding: "var(--space-1)",
            borderRadius: "var(--radius-sm)", fontSize: "var(--fs-body-sm)",
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back to review
        </button>
      </header>

      <div style={{
        flex: 1,
        maxWidth: 600,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-6)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}>
        {/* Seal icon + heading */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto var(--space-4)",
            background: "var(--danger-100)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Lock size={26} color="var(--danger-600)" strokeWidth={1.75} />
          </div>
          <h1
            id="commit-heading"
            ref={headingRef}
            tabIndex={-1}
            style={{
              fontSize: "var(--fs-h3)", fontWeight: 700,
              color: "var(--text-primary)", marginBottom: "var(--space-2)",
              outline: "none",
            }}
          >
            Commit redactions
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--fs-body-sm)", lineHeight: "var(--lh-relaxed)" }}>
            This action is <strong>irreversible</strong>. The accepted redactions will be applied permanently to this document. In-session changes cannot be undone after commit.
          </p>
        </div>

        {/* Summary of what will happen */}
        <Card variant="raised" style={{ padding: "var(--space-5)" }}>
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "var(--fs-body-sm)", marginBottom: "var(--space-4)" }}>
            What will be committed
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <SummaryRow
              count={accepted.length}
              label="spans redacted (individually reviewed)"
              tone="danger"
            />
            {preCheckedToAccept.length > 0 && (
              <SummaryRow
                count={preCheckedToAccept.length}
                label="spans redacted as suggested — not individually reviewed"
                tone="warning"
              />
            )}
            <SummaryRow
              count={rejected.length}
              label="spans kept visible"
              tone="neutral"
            />
            {unresolved.length > 0 && (
              <SummaryRow
                count={unresolved.length}
                label="spans left unreviewed (will be committed as-is)"
                tone="warning"
              />
            )}
          </div>
        </Card>

        {/* Unresolved warnings */}
        {highRiskUnresolved.length > 0 && (
          <div style={{
            padding: "var(--space-4)",
            background: "var(--danger-100)",
            border: "1px solid var(--danger-600)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
              <AlertTriangle size={16} color="var(--danger-600)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontWeight: 700, fontSize: "var(--fs-body-sm)", color: "var(--danger-600)" }}>
                {highRiskUnresolved.length} high-risk span{highRiskUnresolved.length !== 1 ? "s" : ""} still unreviewed
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {highRiskUnresolved.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-body-sm)", color: "var(--danger-600)" }}>
                    {s.text}
                  </code>
                  <Badge tone="danger">{s.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {conflictedUnresolved.length > 0 && (
          <div style={{
            padding: "var(--space-4)",
            background: "var(--warning-100)",
            border: "1px solid var(--warning-600)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
              <AlertTriangle size={16} color="var(--warning-600)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontWeight: 700, fontSize: "var(--fs-body-sm)", color: "var(--warning-600)" }}>
                {conflictedUnresolved.length} conflicted span{conflictedUnresolved.length !== 1 ? "s" : ""} unresolved
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {conflictedUnresolved.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-body-sm)", color: "var(--warning-600)" }}>
                    {s.text}
                  </code>
                  <Badge tone="warning">{s.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--danger-100)", borderRadius: "var(--radius-sm)",
              fontSize: "var(--fs-body-sm)", color: "var(--danger-600)",
            }}
          >
            {error}
          </div>
        )}

        {/* Commit action */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {!confirming ? (
            <>
              <Button
                variant="danger"
                size="lg"
                block
                onClick={() => setConfirming(true)}
                disabled={committing}
              >
                {hasUnresolved
                  ? `Commit anyway — ${unresolved.length} span${unresolved.length !== 1 ? "s" : ""} unreviewed`
                  : "Commit redactions permanently"}
              </Button>
              <Button variant="ghost" size="md" block onClick={onBack}>
                Go back and keep reviewing
              </Button>
            </>
          ) : (
            <Card
              variant="raised"
              role="alert"
              aria-live="assertive"
              style={{ padding: "var(--space-5)" }}
            >
              <p style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
                Are you sure? This cannot be undone.
              </p>
              <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)", marginBottom: "var(--space-5)" }}>
                {accepted.length + preCheckedToAccept.length} span{(accepted.length + preCheckedToAccept.length) !== 1 ? "s" : ""} will be permanently redacted from <strong>{doc.originalFilename}</strong>
                {preCheckedToAccept.length > 0 && (
                  <> — including <strong>{preCheckedToAccept.length}</strong> auto-accepted as suggested without individual review</>
                )}.
              </p>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleCommit}
                  disabled={committing}
                >
                  {committing ? "Committing…" : "Yes, commit permanently"}
                </Button>
                <Button variant="ghost" size="md" onClick={() => setConfirming(false)} disabled={committing}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ count, label, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <Badge tone={tone}>{count}</Badge>
      <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}
