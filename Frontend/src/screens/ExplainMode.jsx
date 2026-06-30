import React, { useMemo, useState } from "react";
import { Eye, AlertTriangle, Info, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { Badge } from "../components/ds/Badge.jsx";
import { Button } from "../components/ds/Button.jsx";
import { Tooltip } from "../components/ds/Tooltip.jsx";
import { spanBadgeTone, confidenceBand, requiresConfirmation } from "../lib/spanUtils.js";

// ── Tooltip / definition strings (spec-exact wording) ─────────────────────

const TOOLTIP = {
  highRisk:
    "This PII type (SSN, financial account, or government ID) carries serious consequences if missed. The extra confirmation step is intentional — not a UI bug.",
  conflict:
    "The LLM and the rule-based layer disagree on this span — on type, exact boundaries, or both. The disagreement is shown rather than resolved, because hiding it would mean asserting confidence the system doesn't have.",
  flagged:
    "At least one detection layer identified this as potential PII. 'Flagged' means it needs your judgment — not that it's definitely sensitive.",
  accepted:
    "A reviewer confirmed this span should be redacted from the document.",
  rejected:
    "A reviewer confirmed this should NOT be redacted, overriding whatever the detection layers suggested.",
};

// ── Document segmentation ──────────────────────────────────────────────────

function buildSegments(rawText, spans) {
  if (!spans.length) return [{ type: "text", text: rawText }];

  const sorted = [...spans].sort((a, b) => a.startOffset - b.startOffset);
  const segments = [];
  let cursor = 0;

  for (const span of sorted) {
    if (span.startOffset < cursor) continue;
    if (span.startOffset > cursor) {
      segments.push({ type: "text", text: rawText.slice(cursor, span.startOffset) });
    }
    segments.push({ type: "span", text: rawText.slice(span.startOffset, span.endOffset), span });
    cursor = span.endOffset;
  }

  if (cursor < rawText.length) {
    segments.push({ type: "text", text: rawText.slice(cursor) });
  }

  return segments;
}

function spanHighlightStyle(span, isSelected) {
  const base = (() => {
    if (span.status === "accepted") return { bg: "var(--success-100)", underline: "var(--success-600)" };
    if (span.status === "rejected") return { bg: "var(--paper-300)", underline: "var(--slate-400)" };
    if (span.riskTier === "high") return { bg: "var(--danger-100)", underline: "var(--danger-600)" };
    if (span.conflict) return { bg: "var(--warning-100)", underline: "var(--warning-600)" };
    return { bg: "var(--ink-100)", underline: "var(--ink-500)" };
  })();

  return {
    background: isSelected ? base.bg.replace("100", "200") : base.bg,
    borderBottom: `2px solid ${base.underline}`,
    borderRadius: "var(--radius-xs)",
    padding: "1px 2px",
    cursor: "pointer",
    outline: isSelected ? `2px solid ${base.underline}` : "none",
    outlineOffset: 1,
  };
}

// ── Shared primitives ──────────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div>
      <p style={{
        fontSize: "var(--fs-caption)", fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-2)",
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function TechRow({ label, children }) {
  return (
    <div>
      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginBottom: 2 }}>{label}</p>
      {children}
    </div>
  );
}

// ── Technical details disclosure ───────────────────────────────────────────
// Collapsed by default. Shows rule ID, raw regex pattern, and raw confidence
// number — accurate but not the primary reading experience.

function TechDetails({ span }) {
  const [open, setOpen] = useState(false);
  const hasContent =
    span.ontologyRuleId ||
    span.ontologyRulePattern ||
    (span.llmConfidence !== null && span.llmConfidence !== undefined) ||
    span.source;

  if (!hasContent) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          border: "none", background: "none", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
          color: "var(--text-muted)", fontSize: "var(--fs-caption)", padding: 0,
        }}
      >
        {open ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
        Technical details
      </button>

      {open && (
        <div style={{
          marginTop: "var(--space-3)",
          padding: "var(--space-3)",
          background: "var(--paper-200)", borderRadius: "var(--radius-sm)",
          display: "flex", flexDirection: "column", gap: "var(--space-3)",
        }}>
          {span.source && (
            <TechRow label="Detection source">
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                {span.source}
              </code>
            </TechRow>
          )}
          {span.llmConfidence !== null && span.llmConfidence !== undefined && (
            <TechRow label="LLM confidence (raw)">
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                {(span.llmConfidence * 100).toFixed(0)}%
              </code>
            </TechRow>
          )}
          {span.ontologyRuleId && (
            <TechRow label="Rule ID">
              <code style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)",
                color: "var(--text-muted)", wordBreak: "break-all",
              }}>
                {span.ontologyRuleId}
              </code>
            </TechRow>
          )}
          {span.ontologyRulePattern && (
            <TechRow label="Regex pattern">
              <code style={{
                fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)",
                color: "var(--text-secondary)",
                background: "var(--paper-300)",
                padding: "4px 8px", borderRadius: "var(--radius-xs)",
                display: "block", wordBreak: "break-all", lineHeight: 1.6,
              }}>
                {span.ontologyRulePattern}
              </code>
            </TechRow>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────
// Hierarchy: (1) what + type badge, (2) action buttons, (3) plain-language
// reasoning from both layers, (4) risk tier, (5) collapsed technical details.

function DetailPanel({ span, onAccept, onReject, readOnly, llmDetector }) {
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const band = confidenceBand(span.llmConfidence);
  const tone = spanBadgeTone(span);
  const isResolved = span.status !== "pending";
  const needsConfirm = requiresConfirmation(span);

  const llmActive = span.source === "LLM" || span.source === "BOTH";
  const ontologyActive = span.source === "ONTOLOGY" || span.source === "BOTH";

  const handleAccept = () => {
    if (needsConfirm && !confirmingAccept) {
      setConfirmingAccept(true);
      return;
    }
    setConfirmingAccept(false);
    onAccept(span.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

      {/* 1. What this is — text + type badge */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <code style={{
          flex: 1, minWidth: 0,
          fontFamily: "var(--font-mono)", fontSize: "var(--fs-body)",
          fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-all",
        }}>
          "{span.text}"
        </code>
        <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0, alignItems: "center" }}>
          <Tooltip content={span.riskTier === "high" ? TOOLTIP.highRisk : span.conflict ? TOOLTIP.conflict : TOOLTIP.flagged}>
            <Badge tone={tone}>{span.type}</Badge>
          </Tooltip>
          {span.conflict && span.riskTier === "high" && (
            <Tooltip content={TOOLTIP.conflict}>
              <AlertTriangle size={14} color="var(--warning-600)" strokeWidth={2} />
            </Tooltip>
          )}
          {isResolved && (
            <Tooltip content={span.status === "accepted" ? TOOLTIP.accepted : TOOLTIP.rejected}>
              <Badge tone={span.status === "accepted" ? "success" : "neutral"} dot>
                {span.status.charAt(0).toUpperCase() + span.status.slice(1)}
              </Badge>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 2. Action buttons — immediately accessible, before reasoning detail */}
      {!readOnly && !isResolved && (
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
              <Button variant="danger" size="sm" onClick={handleAccept}>Yes, accept redaction</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingAccept(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" size="sm" onClick={handleAccept}>Accept redaction</Button>
            <Button variant="ghost" size="sm" onClick={() => onReject(span.id)}>Keep visible</Button>
          </div>
        )
      )}
      {!readOnly && isResolved && (
        <div>
          <Badge tone={span.status === "accepted" ? "success" : "neutral"} dot>
            {span.status.charAt(0).toUpperCase() + span.status.slice(1)}
          </Badge>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

        {/* Conflict notice */}
        {span.conflict && (
          <div style={{
            padding: "var(--space-3)",
            background: "var(--warning-100)", borderRadius: "var(--radius-sm)",
            display: "flex", gap: "var(--space-2)", alignItems: "flex-start",
          }}>
            <AlertTriangle size={14} color="var(--warning-600)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--warning-600)", lineHeight: "var(--lh-relaxed)" }}>
              {TOOLTIP.conflict}
            </p>
          </div>
        )}

        {/* 3. Plain-language reasoning from both layers, side by side in a clear
            structure — no raw patterns, no rule IDs, no debug strings. */}
        <Section label="Why it was flagged">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>

            {/* LLM reasoning */}
            <div>
              <p style={{
                fontSize: "var(--fs-caption)", fontWeight: 600,
                color: llmActive ? "var(--text-secondary)" : "var(--text-muted)",
                marginBottom: "var(--space-1)",
              }}>
                {llmDetector ?? "Language model"}
                {llmActive && band && ` — ${band} confidence`}
              </p>
              {llmActive ? (
                span.llmRationale ? (
                  <p style={{
                    fontSize: "var(--fs-body-sm)", color: "var(--text-primary)",
                    lineHeight: "var(--lh-relaxed)", fontStyle: "italic",
                  }}>
                    "{span.llmRationale}"
                  </p>
                ) : (
                  <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)", fontStyle: "italic" }}>
                    The language model identified this as potential PII.
                  </p>
                )
              ) : (
                <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)", fontStyle: "italic" }}>
                  The language model did not flag this text.
                </p>
              )}
            </div>

            {/* Ontology reasoning */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
              <p style={{
                fontSize: "var(--fs-caption)", fontWeight: 600,
                color: ontologyActive ? "var(--text-secondary)" : "var(--text-muted)",
                marginBottom: "var(--space-1)",
              }}>
                Rule-based layer
              </p>
              {ontologyActive ? (
                <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-primary)", lineHeight: "var(--lh-relaxed)" }}>
                  {span.ontologyRuleDescription ?? "Matched a structural pattern in the text."}
                </p>
              ) : (
                <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)", fontStyle: "italic" }}>
                  The rule-based layer checked this text and found no matching pattern.
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* 4. Risk tier — qualitative label first */}
        <Section label="Risk">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Tooltip content={span.riskTier === "high" ? TOOLTIP.highRisk : undefined}>
              <Badge tone={span.riskTier === "high" ? "danger" : span.riskTier === "medium" ? "blue" : "neutral"}>
                {span.riskTier.charAt(0).toUpperCase() + span.riskTier.slice(1)}
              </Badge>
            </Tooltip>
            {span.riskTier === "high" && (
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--danger-600)", lineHeight: "var(--lh-relaxed)", flex: 1 }}>
                Carries serious consequences if missed. Requires explicit confirmation before redaction.
              </p>
            )}
          </div>
        </Section>

        {/* 5. Technical details — present but collapsed, not the default view */}
        <TechDetails span={span} />
      </div>
    </div>
  );
}

// ── Checked-not-flagged state ──────────────────────────────────────────────

function CheckedNotFlagged() {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      padding: "var(--space-4)", background: "var(--info-100)", borderRadius: "var(--radius-sm)",
    }}>
      <Eye size={16} color="var(--info-600)" strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <p style={{ fontWeight: 600, fontSize: "var(--fs-body-sm)", color: "var(--info-600)" }}>
          Scanned — nothing found
        </p>
        <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginTop: 2, lineHeight: "var(--lh-relaxed)" }}>
          Both detection layers checked this region and found no personally identifiable information.
        </p>
      </div>
    </div>
  );
}

// ── Detection source banner ────────────────────────────────────────────────

function DetectionSourceBanner({ detectionSource }) {
  if (detectionSource === "live" || !detectionSource) return null;

  const isFallback = detectionSource === "fallback";

  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      padding: "var(--space-3) var(--space-4)",
      marginBottom: "var(--space-4)",
      background: isFallback ? "var(--warning-100)" : "var(--info-100)",
      border: `1px solid ${isFallback ? "var(--warning-300)" : "var(--info-300)"}`,
      borderRadius: "var(--radius-sm)",
      color: isFallback ? "var(--warning-700)" : "var(--info-700)",
      fontSize: "var(--fs-caption)",
      lineHeight: "var(--lh-relaxed)",
    }}>
      <FlaskConical size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        <strong>
          {isFallback ? "Fallback detection" : "Mock detection mode"}
          {" — "}
        </strong>
        {isFallback
          ? "NIM was unreachable at processing time; spans came from the mock detector."
          : "USE_MOCK_LLM=true; spans reflect hardcoded test patterns, not a live model."}
      </span>
    </div>
  );
}

// ── Explain mode ───────────────────────────────────────────────────────────

export function ExplainMode({ doc, onAccept, onReject, readOnly }) {
  const [selectedSpanId, setSelectedSpanId] = useState(null);

  const segments = useMemo(
    () => buildSegments(doc.rawText, doc.spans),
    [doc.rawText, doc.spans]
  );

  const selectedSpan = doc.spans.find((s) => s.id === selectedSpanId) ?? null;
  const showCheckedNotFlagged = selectedSpanId === "__clean__";

  // When detection fell back to the mock, show "Mock LLM (fallback)" in the
  // detail panel instead of the live model name — otherwise a user seeing the
  // NIM model name would assume a live response was produced.
  const effectiveLlmDetector = (() => {
    if (doc.detectionSource === "fallback") return "Mock LLM (fallback — NIM unreachable)";
    if (doc.detectionSource === "mock_mode") return "Mock LLM";
    return doc.llmDetector ?? null;
  })();

  return (
    <div style={{ display: "flex", height: "calc(100vh - 112px)", overflow: "hidden" }}>

      {/* Document viewer */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "var(--space-7) var(--space-6)",
        borderRight: "1px solid var(--border-subtle)",
      }}>
        <div style={{ maxWidth: "var(--container-narrow)", margin: "0 auto" }}>

          <DetectionSourceBanner detectionSource={doc.detectionSource} />

          {/* Status legend with full definitions on focus/hover */}
          <div style={{
            display: "flex", gap: "var(--space-4)", flexWrap: "wrap",
            marginBottom: "var(--space-6)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--paper-200)", borderRadius: "var(--radius-sm)",
            fontSize: "var(--fs-caption)", color: "var(--text-muted)",
          }}>
            <LegendItem color="var(--danger-100)" border="var(--danger-600)" label="High risk" tooltip={TOOLTIP.highRisk} />
            <LegendItem color="var(--warning-100)" border="var(--warning-600)" label="Conflict" tooltip={TOOLTIP.conflict} />
            <LegendItem color="var(--ink-100)" border="var(--ink-500)" label="Flagged" tooltip={TOOLTIP.flagged} />
            <LegendItem color="var(--success-100)" border="var(--success-600)" label="Accepted" tooltip={TOOLTIP.accepted} />
            <LegendItem color="var(--paper-300)" border="var(--slate-400)" label="Rejected" tooltip={TOOLTIP.rejected} />
          </div>

          {/* Document text */}
          <p style={{
            fontFamily: "var(--font-body)", fontSize: "var(--fs-body-lg)",
            lineHeight: 2, color: "var(--text-primary)",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {segments.map((seg, i) =>
              seg.type === "text" ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <mark
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={`Span: ${seg.span.text} (${seg.span.type})`}
                  onClick={() => setSelectedSpanId(seg.span.id === selectedSpanId ? null : seg.span.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedSpanId(seg.span.id); }}
                  style={{
                    ...spanHighlightStyle(seg.span, selectedSpanId === seg.span.id),
                    background: undefined,
                    ...spanHighlightStyle(seg.span, selectedSpanId === seg.span.id),
                  }}
                >
                  {seg.text}
                </mark>
              )
            )}
          </p>

          {/* Checked-not-flagged affordance */}
          <div style={{ marginTop: "var(--space-7)" }}>
            <button
              onClick={() => setSelectedSpanId(selectedSpanId === "__clean__" ? null : "__clean__")}
              style={{
                border: "none", background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "var(--space-2)",
                color: "var(--text-muted)", fontSize: "var(--fs-caption)", padding: 0,
              }}
            >
              <Eye size={13} strokeWidth={2} />
              What about the rest of the text?
            </button>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{
        width: 360, flexShrink: 0,
        overflowY: "auto", padding: "var(--space-6)",
        background: "var(--surface-raised)",
      }}>
        {!selectedSpan && !showCheckedNotFlagged && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: "var(--space-3)",
            color: "var(--text-muted)", textAlign: "center",
          }}>
            <Info size={24} strokeWidth={1.5} color="var(--slate-400)" />
            <p style={{ fontSize: "var(--fs-body-sm)" }}>
              Click any highlighted span to see its detection details.
            </p>
          </div>
        )}

        {showCheckedNotFlagged && !selectedSpan && <CheckedNotFlagged />}

        {selectedSpan && (
          <DetailPanel
            span={selectedSpan}
            onAccept={onAccept}
            onReject={onReject}
            readOnly={readOnly}
            llmDetector={effectiveLlmDetector}
          />
        )}
      </div>
    </div>
  );
}

// ── Legend item ────────────────────────────────────────────────────────────
// Keyboard-accessible: Tooltip fires on focus as well as hover (Tooltip.jsx
// sets tabIndex=0 and handles onFocus). The underline signals interactivity
// without interrupting normal tab flow.

function LegendItem({ color, border, label, tooltip }) {
  return (
    <Tooltip content={tooltip} placement="bottom">
      <span style={{ display: "flex", alignItems: "center", gap: 6, cursor: "help" }}>
        <span style={{
          display: "inline-block", width: 14, height: 12,
          background: color, borderBottom: `2px solid ${border}`,
          borderRadius: "var(--radius-xs)",
        }} />
        <span style={{ borderBottom: "1px dotted currentColor" }}>{label}</span>
      </span>
    </Tooltip>
  );
}
