import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { Badge } from "../components/ds/Badge.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Card } from "../components/ds/Card.jsx";
import { Modal } from "../components/ds/Modal.jsx";
import { Tooltip } from "../components/ds/Tooltip.jsx";
import { spanBadgeTone, confidenceBand, sourceLabel, sortByPriority, requiresConfirmation, isPreChecked } from "../lib/spanUtils.js";


// ── Tooltip content strings (spec-exact wording) ──────────────────────────

const TOOLTIP = {
  highRisk:
    "This span's PII type (SSN, financial account, or government ID) carries serious consequences if missed. The extra confirmation step is intentional — not a UI bug.",
  conflict:
    "The LLM and the rule-based layer disagree on this span — on type, exact boundaries, or both. Shown, not resolved, because hiding a disagreement would mean asserting confidence the system doesn't have.",
  flagged:
    "At least one detection layer identified this as potential PII. 'Flagged' means it needs your judgment — not that it's definitely sensitive.",
  accepted:
    "A reviewer confirmed this span should be redacted from the document.",
  rejected:
    "A reviewer confirmed this should NOT be redacted, overriding whatever the detection layers suggested.",
  suggested:
    "Both detection layers identified this as PII with high confidence and no conflict. It will be accepted for redaction at commit time unless you revoke this suggestion. Press Revoke if you disagree — the keyboard shortcuts A and R are blocked on suggested spans intentionally.",
};

// ── Span row ───────────────────────────────────────────────────────────────

function SpanRow({ span, isFocused, onFocus, onAccept, onReject, readOnly, isSuggested, onRevokePreCheck }) {
  const needsConfirm = requiresConfirmation(span);
  const isResolved = span.status !== "pending";
  // High-risk / conflicted spans default to expanded; routine low-risk collapse.
  const [expanded, setExpanded] = useState(needsConfirm);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const rowRef = useRef(null);

  const tone = spanBadgeTone(span);
  const band = confidenceBand(span.llmConfidence);

  // Scroll into view when keyboard focus lands here.
  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  const handleAccept = () => {
    if (needsConfirm && !confirmingAccept) {
      setConfirmingAccept(true);
      return;
    }
    setConfirmingAccept(false);
    onAccept(span.id);
  };

  const handleReject = () => {
    setConfirmingAccept(false);
    onReject(span.id);
  };

  const borderColor = (() => {
    if (isResolved && span.status === "accepted") return "var(--success-600)";
    if (isResolved && span.status === "rejected") return "var(--slate-400)";
    if (isFocused) return "var(--ink-600)";
    if (span.riskTier === "high") return "var(--danger-600)";
    if (span.conflict) return "var(--warning-600)";
    return "var(--border-default)";
  })();

  // Tooltip for the type badge: high-risk → highRisk, conflict → conflict, else → flagged
  const badgeTooltip = span.riskTier === "high"
    ? TOOLTIP.highRisk
    : span.conflict
    ? TOOLTIP.conflict
    : TOOLTIP.flagged;

  return (
    <div
      ref={rowRef}
      onClick={() => onFocus()}
      style={{
        border: `1.5px solid ${borderColor}`,
        borderRadius: "var(--radius-md)",
        background: isResolved ? "var(--paper-200)" : "var(--surface-raised)",
        padding: "var(--space-3) var(--space-4)",
        cursor: "pointer",
        transition: "border-color var(--dur-fast) var(--ease-standard)",
        opacity: isResolved ? 0.65 : 1,
      }}
    >
      {/* Row header — always visible */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <code style={{
            fontFamily: "var(--font-mono)", fontWeight: 600,
            fontSize: "var(--fs-body-sm)", color: "var(--text-primary)",
            background: "var(--paper-200)", padding: "2px 6px", borderRadius: "var(--radius-xs)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200,
          }}>
            {span.text}
          </code>

          <Tooltip content={badgeTooltip}>
            <Badge tone={tone}>{span.type}</Badge>
          </Tooltip>

          {span.conflict && span.riskTier === "high" && (
            <Tooltip content={TOOLTIP.conflict}>
              <AlertTriangle size={13} color="var(--warning-600)" strokeWidth={2} />
            </Tooltip>
          )}

          {isResolved && (
            <Tooltip content={span.status === "accepted" ? TOOLTIP.accepted : TOOLTIP.rejected}>
              <Badge tone={span.status === "accepted" ? "success" : "neutral"} dot>
                {span.status}
              </Badge>
            </Tooltip>
          )}

          {!isResolved && isSuggested && (
            <Tooltip content={TOOLTIP.suggested}>
              <span style={{
                display: "inline-flex", alignItems: "center",
                fontSize: "var(--fs-caption)", color: "var(--success-700)",
                background: "var(--success-100)",
                padding: "2px 8px", borderRadius: "var(--radius-pill)",
                fontWeight: 500, whiteSpace: "nowrap", cursor: "help",
              }}>
                Suggested ✓
              </span>
            </Tooltip>
          )}
        </div>

        {/* Inline quick-action for routine (non-high-risk, non-conflicted) rows */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
          {!readOnly && !isResolved && !needsConfirm && isSuggested && (
            <button
              onClick={(e) => { e.stopPropagation(); onRevokePreCheck(span.id); }}
              title="Revoke pre-check suggestion"
              style={{ ...iconBtnStyle("var(--text-muted)"), fontSize: "var(--fs-caption)" }}
              aria-label="Revoke suggestion"
            >
              Revoke
            </button>
          )}
          {!readOnly && !isResolved && !needsConfirm && !isSuggested && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(span.id); }}
                title="Accept redaction (A)"
                style={iconBtnStyle("var(--success-600)")}
                aria-label="Accept redaction"
              >
                <CheckCircle size={18} strokeWidth={2} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(span.id); }}
                title="Keep visible (R)"
                style={iconBtnStyle("var(--slate-500)")}
                aria-label="Keep visible"
              >
                <XCircle size={18} strokeWidth={2} />
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            style={iconBtnStyle("var(--slate-400)")}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
            <MetaItem label="Source" value={sourceLabel(span.source)} />
            {band && <MetaItem label="Confidence" value={band} />}
            <MetaItem label="Risk" value={span.riskTier} />
          </div>

          {span.llmRationale && (
            <p style={{
              fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)",
              lineHeight: "var(--lh-relaxed)", fontStyle: "italic",
            }}>
              "{span.llmRationale}"
            </p>
          )}

          {isSuggested && !readOnly && !isResolved && (
            <div style={{
              padding: "var(--space-3)",
              background: "var(--success-100)", borderRadius: "var(--radius-sm)",
              display: "flex", flexDirection: "column", gap: "var(--space-2)",
            }}>
              <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--success-700)", lineHeight: "var(--lh-relaxed)" }}>
                Both detection layers identified this as PII with high confidence, and there is no conflict between them. It will be accepted for redaction at commit time unless you revoke this suggestion.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onRevokePreCheck(span.id); }}
                style={{ ...iconBtnStyle("var(--text-muted)"), fontSize: "var(--fs-caption)", alignSelf: "flex-start" }}
              >
                Revoke suggestion
              </button>
            </div>
          )}

          {span.conflict && (
            <div style={{
              display: "flex", gap: "var(--space-2)", alignItems: "flex-start",
              padding: "var(--space-3)",
              background: "var(--warning-100)", borderRadius: "var(--radius-sm)",
            }}>
              <AlertTriangle size={14} color="var(--warning-600)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--warning-600)", lineHeight: "var(--lh-relaxed)" }}>
                {TOOLTIP.conflict}
              </p>
            </div>
          )}

          {/* High-risk confirmation step */}
          {needsConfirm && !readOnly && !isResolved && (
            confirmingAccept ? (
              <div style={{
                padding: "var(--space-3)",
                background: "var(--danger-100)", borderRadius: "var(--radius-sm)",
                display: "flex", flexDirection: "column", gap: "var(--space-3)",
              }}>
                <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--danger-600)", fontWeight: 600 }}>
                  Confirm: accept this {span.riskTier === "high" ? "high-risk" : "conflicted"} span for redaction?
                </p>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(); }}>
                    Yes, accept redaction
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmingAccept(false); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(); }}>
                  Accept redaction
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleReject(); }}>
                  Keep visible
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-primary)", fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function iconBtnStyle(color) {
  return {
    border: "none", background: "none", cursor: "pointer",
    color, padding: 4, borderRadius: "var(--radius-xs)",
    display: "inline-flex", alignItems: "center",
    transition: "opacity var(--dur-fast) var(--ease-standard)",
  };
}

// ── Bulk action modal ──────────────────────────────────────────────────────

function BulkModal({ open, onClose, spans, action, onConfirm }) {
  const label = action === "accepted" ? "accept for redaction" : "keep visible";
  return (
    <Modal open={open} onClose={onClose} title={`Bulk ${label}`} width={500}>
      <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)", lineHeight: "var(--lh-relaxed)" }}>
        This will mark the following {spans.length} span{spans.length !== 1 ? "s" : ""} as <strong>{action === "accepted" ? "redacted" : "visible"}</strong>. Review the full list before confirming — verify each item is actually the same entity.
      </p>
      <div style={{
        display: "flex", flexDirection: "column", gap: "var(--space-2)",
        maxHeight: 240, overflowY: "auto",
        border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
        padding: "var(--space-3)",
        marginBottom: "var(--space-5)",
      }}>
        {spans.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-body-sm)", color: "var(--text-primary)" }}>
              {s.text}
            </code>
            <Badge tone={spanBadgeTone(s)}>{s.type}</Badge>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          variant={action === "accepted" ? "primary" : "secondary"}
          size="sm"
          onClick={() => { onConfirm(); onClose(); }}
        >
          Confirm — {label} {spans.length} span{spans.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </Modal>
  );
}

// ── Review mode ────────────────────────────────────────────────────────────

export function ReviewMode({ doc, onAccept, onReject, onBulkAccept, onBulkReject, readOnly, revokedPreChecked = new Set(), onRevokePreCheck }) {
  const sorted = useMemo(() => sortByPriority(doc.spans), [doc.spans]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [bulkModal, setBulkModal] = useState(null); // { spans, action }

  const pendingSpans = sorted.filter((s) => s.status === "pending");
  const resolvedCount = doc.spans.length - pendingSpans.length;

  // Keyboard handler
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const span = sorted[focusIdx];
      if (!span) return;

      const isResolved = span.status !== "pending";
      const needsConfirm = requiresConfirmation(span);
      // Suggested spans show "Revoke" instead of accept/reject buttons. Block A/R so
      // the keyboard can't silently bypass the pre-check UI contract on those rows.
      const isSuggested = isPreChecked(span) && span.status === "pending" && !revokedPreChecked.has(span.id);

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + 1, sorted.length - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - 1, 0));
          break;
        case "a":
          if (!readOnly && !isResolved && !needsConfirm && !isSuggested) {
            e.preventDefault();
            onAccept(span.id);
            setFocusIdx((i) => Math.min(i + 1, sorted.length - 1));
          }
          break;
        case "r":
          if (!readOnly && !isResolved && !needsConfirm && !isSuggested) {
            e.preventDefault();
            onReject(span.id);
            setFocusIdx((i) => Math.min(i + 1, sorted.length - 1));
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusIdx, sorted, onAccept, onReject, readOnly, revokedPreChecked]);

  // Group identical text for bulk actions.
  const entityGroups = useMemo(() => {
    const groups = {};
    for (const s of doc.spans) {
      const key = `${s.text}::${s.type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return Object.values(groups).filter((g) => g.length > 1);
  }, [doc.spans]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)", overflow: "hidden" }}>
      {/* Queue */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {/* Progress bar */}
        <div style={{ marginBottom: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--fs-body-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
              {resolvedCount} of {doc.spans.length} reviewed
            </span>
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
              {pendingSpans.length} remaining
            </span>
          </div>
          <div style={{ height: 4, background: "var(--paper-300)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(resolvedCount / doc.spans.length) * 100}%`,
              background: "var(--ink-600)",
              borderRadius: "var(--radius-pill)",
              transition: "width var(--dur-slow) var(--ease-emphasized)",
            }} />
          </div>
        </div>

        {sorted.map((span, idx) => (
          <SpanRow
            key={span.id}
            span={span}
            isFocused={idx === focusIdx}
            onFocus={() => setFocusIdx(idx)}
            onAccept={onAccept}
            onReject={onReject}
            readOnly={readOnly}
            isSuggested={isPreChecked(span) && span.status === "pending" && !revokedPreChecked.has(span.id)}
            onRevokePreCheck={onRevokePreCheck ?? (() => {})}
          />
        ))}
      </div>

      {/* Sidebar: keyboard guide + bulk actions */}
      <div style={{
        width: 240,
        flexShrink: 0,
        padding: "var(--space-5)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        overflowY: "auto",
      }}>
        {!readOnly && (
          <Card style={{ padding: "var(--space-4)" }}>
            <p style={{ fontSize: "var(--fs-caption)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-3)" }}>
              Keyboard shortcuts
            </p>
            {[
              ["A", "Accept (routine only)"],
              ["R", "Keep visible (routine only)"],
              ["J / ↓", "Next span"],
              ["K / ↑", "Previous span"],
            ].map(([key, label]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", background: "var(--paper-200)", padding: "1px 5px", borderRadius: "var(--radius-xs)" }}>{key}</code>
                <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", textAlign: "right", maxWidth: 120 }}>{label}</span>
              </div>
            ))}
            <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginTop: "var(--space-3)", lineHeight: "var(--lh-relaxed)" }}>
              Blocked on high-risk, conflicted, and pre-checked suggested spans — these require an explicit click intentionally.
            </p>
          </Card>
        )}

        {/* Bulk actions */}
        {entityGroups.length > 0 && !readOnly && (
          <div>
            <p style={{ fontSize: "var(--fs-caption)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-3)" }}>
              Bulk actions
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {entityGroups.map((group) => (
                <div key={group[0].text + group[0].type} style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <Layers size={12} color="var(--text-muted)" strokeWidth={2} />
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--text-primary)", fontWeight: 600 }}>
                      {group[0].text}
                    </code>
                    <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>×{group.length}</span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    <button
                      onClick={() => setBulkModal({ spans: group, action: "accepted" })}
                      style={{ ...iconBtnStyle("var(--success-600)"), fontSize: "var(--fs-caption)" }}
                    >
                      Accept all
                    </button>
                    <button
                      onClick={() => setBulkModal({ spans: group, action: "rejected" })}
                      style={{ ...iconBtnStyle("var(--slate-500)"), fontSize: "var(--fs-caption)" }}
                    >
                      Reject all
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {bulkModal && (
        <BulkModal
          open
          onClose={() => setBulkModal(null)}
          spans={bulkModal.spans}
          action={bulkModal.action}
          onConfirm={() => {
            const ids = bulkModal.spans.map((s) => s.id);
            if (bulkModal.action === "accepted") onBulkAccept(ids);
            else onBulkReject(ids);
          }}
        />
      )}
    </div>
  );
}
