import React from "react";
import { Clock, CheckCircle, XCircle, Edit3 } from "lucide-react";
import { Card } from "./ds/Card.jsx";
import { Badge } from "./ds/Badge.jsx";

// Backend stores action as past tense ("accept") and span status as past tense ("accepted").
// Normalize to past tense for display.
const toDisplayAction = (action) => {
  if (action === "accept") return "accepted";
  if (action === "reject") return "rejected";
  if (action === "override") return "overridden";
  // auto_accept_suggested: pre-check fast-path accepted at commit time without individual review.
  if (action === "auto_accept_suggested") return "auto-accepted";
  return action; // "accepted", "rejected", "overridden", "committed" pass through
};

function AuditIcon({ action }) {
  const normalized = toDisplayAction(action);
  const props = { size: 16, strokeWidth: 2 };
  if (normalized === "accepted") return <CheckCircle {...props} color="var(--success-600)" />;
  if (normalized === "auto-accepted") return <CheckCircle {...props} color="var(--success-400)" />;
  if (normalized === "rejected") return <XCircle {...props} color="var(--slate-500)" />;
  if (normalized === "overridden") return <Edit3 {...props} color="var(--warning-600)" />;
  if (normalized === "committed") return <CheckCircle {...props} color="var(--ink-600)" />;
  return <Clock {...props} color="var(--slate-400)" />;
}

function auditTone(action) {
  const normalized = toDisplayAction(action);
  if (normalized === "accepted") return "success";
  if (normalized === "auto-accepted") return "success";
  if (normalized === "rejected") return "neutral";
  if (normalized === "overridden") return "warning";
  if (normalized === "committed") return "blue";
  return "neutral";
}

export function AuditTrail({ audit, doc }) {
  // Build a combined timeline from spans' reviewed status when live audit is empty.
  const entries = audit.length > 0
    ? audit
    : buildFallbackTimeline(doc);

  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "var(--space-7) var(--space-6)",
    }}>
      <p style={{
        fontFamily: "var(--font-body)", fontSize: "var(--fs-overline)",
        fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--brass-700)", marginBottom: "var(--space-2)",
      }}>
        Audit trail
      </p>
      <h2 style={{
        fontSize: "var(--fs-h3)", fontWeight: 700,
        color: "var(--text-primary)", marginBottom: "var(--space-6)",
      }}>
        Decision log — {doc.originalFilename}
      </h2>

      {entries.length === 0 ? (
        <Card style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <Clock size={24} color="var(--slate-400)" strokeWidth={1.5} style={{ marginBottom: "var(--space-3)" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-body-sm)" }}>
            No decisions recorded yet. Accept or reject spans to build the audit trail.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {entries.map((entry, i) => (
            <div key={entry.id ?? i} style={{ display: "flex", gap: "var(--space-4)" }}>
              {/* Timeline line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 32 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--surface-raised)",
                  border: "2px solid var(--border-default)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 1, flexShrink: 0,
                }}>
                  <AuditIcon action={entry.action ?? entry.status} />
                </div>
                {i < entries.length - 1 && (
                  <div style={{ flex: 1, width: 2, background: "var(--border-subtle)", minHeight: 24 }} />
                )}
              </div>

              {/* Entry content */}
              <div style={{ flex: 1, paddingBottom: "var(--space-5)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-1)" }}>
                  <div style={{ flex: 1 }}>
                    {(entry.span?.text ?? entry.spanText) ? (
                      <code style={{
                        fontFamily: "var(--font-mono)", fontSize: "var(--fs-body-sm)",
                        fontWeight: 600, color: "var(--text-primary)",
                      }}>
                        "{entry.span?.text ?? entry.spanText}"
                      </code>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: "var(--fs-body-sm)", color: "var(--text-primary)" }}>
                        Document committed
                      </span>
                    )}
                  </div>
                  <Badge tone={auditTone(entry.action ?? entry.status)}>
                    {toDisplayAction(entry.action ?? entry.status)}
                  </Badge>
                </div>

                {(entry.action === "auto_accept_suggested") && (
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Pre-check fast-path — accepted at commit time, not individually reviewed
                  </p>
                )}

                {entry.source && (
                  <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                    Source: {entry.source}
                  </p>
                )}

                {entry.overrideRationale && (
                  <p style={{
                    fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)",
                    fontStyle: "italic", marginTop: "var(--space-1)",
                  }}>
                    Override note: "{entry.overrideRationale}"
                  </p>
                )}

                <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  {entry.reviewedAt
                    ? new Date(entry.reviewedAt).toLocaleString()
                    : entry.timestamp
                      ? new Date(entry.timestamp).toLocaleString()
                      : "—"}
                  {(entry.actor ?? entry.reviewedBy) && ` · ${entry.actor ?? entry.reviewedBy}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildFallbackTimeline(doc) {
  const resolved = doc.spans
    .filter((s) => s.status !== "pending")
    .map((s) => ({
      id: s.id,
      spanText: s.text,
      action: s.status,
      source: s.source,
      reviewedAt: s.reviewedAt,
      reviewedBy: s.reviewedBy,
    }));

  if (doc.status === "committed") {
    resolved.push({
      id: "__commit__",
      spanText: null,
      action: "committed",
      reviewedAt: null,
    });
  }

  return resolved;
}
