import React, { useCallback, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Download, X, FlaskConical } from "lucide-react";
import { Card } from "../components/ds/Card.jsx";
import { Badge } from "../components/ds/Badge.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Tabs } from "../components/ds/Tabs.jsx";
import { Tooltip } from "../components/ds/Tooltip.jsx";
import { useDocument } from "../api/useDocument.js";
import { isPreChecked } from "../lib/spanUtils.js";
import { ExplainMode } from "./ExplainMode.jsx";
import { ReviewMode } from "./ReviewMode.jsx";
import { CommitScreen } from "./CommitScreen.jsx";
import { AuditTrail } from "../components/AuditTrail.jsx";

const MODES = [
  { id: "overview", label: "Overview" },
  { id: "explain", label: "Explain" },
  { id: "review", label: "Review" },
  { id: "audit", label: "Audit trail" },
];

export function DocumentScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const batchId = location.state?.batchId ?? null;
  const [mode, setMode] = useState("overview");
  const [committing, setCommitting] = useState(false);
  const [preCheckedToAccept, setPreCheckedToAccept] = useState([]);
  const [revokedPreChecked, setRevokedPreChecked] = useState(new Set());

  const revokePreCheck = useCallback((spanId) => {
    setRevokedPreChecked((prev) => new Set([...prev, spanId]));
  }, []);

  const {
    doc, summary, audit, loading, error,
    mutationError, clearMutationError,
    acceptSpan, rejectSpan, overrideSpan,
    bulkAccept, bulkAcceptPreChecked, bulkReject, commit, downloadRedacted, refreshAudit,
  } = useDocument(id);

  if (loading) return <FullPageMessage>Loading document…</FullPageMessage>;
  if (error) return <FullPageMessage error>Failed to load: {error}</FullPageMessage>;
  if (!doc) return null;

  const isCommitted = doc.status === "committed";

  if (committing) {
    return (
      <CommitScreen
        doc={doc}
        summary={summary}
        preCheckedToAccept={preCheckedToAccept}
        onBack={() => { setCommitting(false); setPreCheckedToAccept([]); }}
        onCommit={async () => {
          // Pre-checked accepts fire here, inside the commit confirmation, so the user
          // has seen the count before anything is written. Uses a distinct action value
          // so audit entries are distinguishable from manually reviewed accepts.
          if (preCheckedToAccept.length > 0) {
            await bulkAcceptPreChecked(preCheckedToAccept.map((s) => s.id));
          }
          await commit();
          setCommitting(false);
          setPreCheckedToAccept([]);
          setMode("audit");
          await refreshAudit();
        }}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top bar */}
      <header style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 var(--space-6)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        height: 56,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(batchId ? `/batch/${batchId}` : "/")}
          aria-label={batchId ? "Back to queue" : "Back to upload"}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            padding: "var(--space-1)", borderRadius: "var(--radius-sm)",
          }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        <span style={{
          fontWeight: 600, color: "var(--text-primary)",
          fontSize: "var(--fs-body-sm)",
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {doc.originalFilename}
        </span>

        {isCommitted && (
          <>
            <Badge tone="success" dot>Committed</Badge>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Download size={15} strokeWidth={2} />}
              onClick={downloadRedacted}
            >
              Download .txt
            </Button>
          </>
        )}

        {!isCommitted && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              // Compute pre-checked spans now so CommitScreen can display the count
              // before any API call fires. The actual accept happens inside onCommit,
              // after the user has confirmed on the CommitScreen.
              const toAccept = (doc?.spans ?? []).filter(
                (s) => isPreChecked(s) && s.status === "pending" && !revokedPreChecked.has(s.id)
              );
              setPreCheckedToAccept(toAccept);
              setCommitting(true);
            }}
          >
            Commit redactions
          </Button>
        )}
      </header>

      {/* Mode tabs */}
      <div style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 var(--space-6)",
      }}>
        <Tabs
          items={MODES}
          value={mode}
          onChange={setMode}
          style={{ border: "none" }}
        />
      </div>

      {/* Mutation error banner */}
      {mutationError && (
        <div role="alert" style={{
          display: "flex", alignItems: "center", gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-5)",
          background: "var(--danger-100)",
          borderBottom: "1px solid var(--danger-300)",
          color: "var(--danger-700)",
          fontSize: "var(--fs-body-sm)",
          flexShrink: 0,
        }}>
          <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{mutationError}</span>
          <button
            onClick={clearMutationError}
            aria-label="Dismiss error"
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--danger-600)", padding: 4,
              display: "inline-flex", alignItems: "center",
              borderRadius: "var(--radius-xs)",
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {mode === "overview" && (
          <OverviewPanel
            doc={doc}
            summary={summary}
            onSelectMode={setMode}
          />
        )}
        {mode === "explain" && (
          <ExplainMode
            doc={doc}
            onAccept={acceptSpan}
            onReject={rejectSpan}
            readOnly={isCommitted}
          />
        )}
        {mode === "review" && (
          <ReviewMode
            doc={doc}
            onAccept={acceptSpan}
            onReject={rejectSpan}
            onOverride={overrideSpan}
            onBulkAccept={bulkAccept}
            onBulkReject={bulkReject}
            readOnly={isCommitted}
            revokedPreChecked={revokedPreChecked}
            onRevokePreCheck={revokePreCheck}
          />
        )}
        {mode === "audit" && (
          <AuditTrail audit={audit} doc={doc} />
        )}
      </div>
    </div>
  );
}

const TOOLTIP_HIGH_RISK =
  "SSN, financial account, and government ID carry serious consequences if missed. Review of these spans requires an explicit confirmation step — the extra friction is intentional, not a UI bug.";

const TOOLTIP_CONFLICT =
  "The LLM and the rule-based layer disagreed on at least one span — on type, exact boundaries, or both. The disagreement is shown rather than resolved, because hiding it would mean asserting confidence the system doesn't have.";

const TOOLTIP_FLAGGED =
  "At least one detection layer identified this as potential PII. 'Flagged' means it needs your judgment — not that it's definitely sensitive.";

function DetectionSourceBanner({ detectionSource }) {
  if (detectionSource === "live" || !detectionSource) return null;

  const isFallback = detectionSource === "fallback";
  const isMock = detectionSource === "mock_mode";

  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      padding: "var(--space-3) var(--space-4)",
      background: isFallback ? "var(--warning-100)" : "var(--info-100)",
      border: `1px solid ${isFallback ? "var(--warning-300)" : "var(--info-300)"}`,
      borderRadius: "var(--radius-sm)",
      color: isFallback ? "var(--warning-700)" : "var(--info-700)",
      fontSize: "var(--fs-body-sm)",
      lineHeight: "var(--lh-relaxed)",
    }}>
      <FlaskConical size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <span style={{ fontWeight: 700 }}>
          {isFallback ? "Fallback detection active" : "Mock detection mode"}
          {" — "}
        </span>
        {isFallback
          ? "The live NVIDIA NIM model was unreachable when this document was processed. Spans were detected by the mock detector, not the configured live model. Results may differ from a real NIM run."
          : "This document was processed with the mock detector (USE_MOCK_LLM=true). Spans reflect hardcoded test patterns, not a live model response."}
      </div>
    </div>
  );
}

function OverviewPanel({ doc, summary, onSelectMode }) {
  if (!summary) return null;

  const unresolved = doc.spans.filter((s) => s.status === "pending").length;
  const highRisk = doc.spans.filter((s) => s.riskTier === "high" && s.status === "pending").length;
  const conflicts = doc.spans.filter((s) => s.conflict && s.status === "pending").length;

  return (
    <div style={{
      maxWidth: 760,
      margin: "0 auto",
      padding: "var(--space-7) var(--space-6)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)",
    }}>
      <DetectionSourceBanner detectionSource={doc.detectionSource} />
      <div>
        <p style={{
          fontFamily: "var(--font-body)", fontSize: "var(--fs-overline)",
          fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--brass-700)", marginBottom: "var(--space-2)",
        }}>
          Document summary
        </p>
        <h2 style={{
          fontSize: "var(--fs-h3)", fontWeight: 700,
          color: "var(--text-primary)", marginBottom: "var(--space-1)",
        }}>
          {summary.totalSpans} spans detected
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--fs-body-sm)" }}>
          {unresolved} pending review
          {conflicts > 0 && ` · ${conflicts} conflict${conflicts !== 1 ? "s" : ""}`}
          {highRisk > 0 && ` · ${highRisk} high-risk`}
        </p>
      </div>

      {/* Count cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
        {Object.entries(summary.byType).map(([type, count]) => (
          <Card key={type} style={{ padding: "var(--space-4)" }}>
            <p style={{ fontSize: "var(--fs-h3)", fontWeight: 700, color: "var(--text-primary)" }}>{count}</p>
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginTop: 2 }}>{type}</p>
          </Card>
        ))}
      </div>

      {/* Risk tier breakdown */}
      <Card style={{ padding: "var(--space-5)" }}>
        <p style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "var(--fs-body-sm)", marginBottom: "var(--space-4)" }}>
          By risk tier
        </p>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {[
            { tier: "high", label: "High risk", tone: "danger", tooltip: TOOLTIP_HIGH_RISK },
            { tier: "medium", label: "Medium risk", tone: "neutral", tooltip: TOOLTIP_FLAGGED },
            { tier: "low", label: "Low risk", tone: "neutral", tooltip: TOOLTIP_FLAGGED },
          ].map(({ tier, label, tone, tooltip }) => (
            summary.byRiskTier[tier] > 0 && (
              <div key={tier} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Badge tone={tone}>{summary.byRiskTier[tier]}</Badge>
                <Tooltip content={tooltip} placement="bottom">
                  <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", cursor: "help" }}>{label}</span>
                </Tooltip>
              </div>
            )
          ))}
          {summary.conflicts > 0 && (
            <Tooltip content={TOOLTIP_CONFLICT} placement="bottom">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "help" }}>
                <AlertTriangle size={14} color="var(--warning-600)" strokeWidth={2} />
                <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--warning-600)", fontWeight: 600 }}>
                  {summary.conflicts} conflict{summary.conflicts !== 1 ? "s" : ""}
                </span>
              </div>
            </Tooltip>
          )}
        </div>
      </Card>

      {/* Mode choice */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <Card
          interactive
          style={{ padding: "var(--space-5)", cursor: "pointer" }}
          onClick={() => onSelectMode("explain")}
        >
          <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
            Explain mode
          </p>
          <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)" }}>
            Read the full document with every detection marked. Click any span to see exactly which layers fired, their rationale, and the literal rule or pattern that matched.
          </p>
        </Card>
        <Card
          interactive
          style={{ padding: "var(--space-5)", cursor: "pointer" }}
          onClick={() => onSelectMode("review")}
        >
          <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
            Review mode
          </p>
          <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)" }}>
            Work through a priority queue — highest-stakes items first. Use keyboard shortcuts to accept or reject quickly. High-risk and conflicted spans require an explicit confirmation step.
          </p>
        </Card>
      </div>
    </div>
  );
}

function FullPageMessage({ children, error }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: error ? "var(--danger-600)" : "var(--text-muted)",
      fontSize: "var(--fs-body-sm)",
    }}>
      {children}
    </div>
  );
}
