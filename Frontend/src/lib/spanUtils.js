// Maps a span's state to Badge tone following the spec's color rules:
//   conflict === true → "warning" (amber) regardless of riskTier,
//     unless riskTier === "high" → "danger" (terracotta) wins; conflict shown as secondary icon
//   riskTier === "high" → "danger"
//   routine low-confidence (no conflict) → "blue"
//   low risk, high confidence → "neutral"
export function spanBadgeTone(span) {
  if (span.riskTier === "high") return "danger";
  if (span.conflict) return "warning";
  if (span.llmConfidence !== null && span.llmConfidence < 0.75) return "blue";
  return "neutral";
}

// Qualitative confidence band for display.
export function confidenceBand(llmConfidence) {
  if (llmConfidence === null || llmConfidence === undefined) return null;
  if (llmConfidence >= 0.85) return "High";
  if (llmConfidence >= 0.65) return "Medium";
  return "Low";
}

// Priority sort for Review mode queue: highest priorityScore first.
export function sortByPriority(spans) {
  return [...spans].sort((a, b) => b.priorityScore - a.priorityScore);
}

// A span requires explicit confirmation before single-keystroke accept.
export function requiresConfirmation(span) {
  return span.riskTier === "high" || span.conflict;
}

// Source label for Explain mode detail panel.
export function sourceLabel(source) {
  return {
    LLM: "LLM only",
    ONTOLOGY: "Ontology only",
    BOTH: "LLM + ontology",
  }[source] ?? source;
}

// A span qualifies for pre-checked fast path in Review mode when:
// both layers agree (source=BOTH), no conflict, not high-risk, and LLM confidence is high.
// Nothing is written to spans.status until the reviewer confirms or revokes at commit time.
export function isPreChecked(span) {
  return (
    span.source === "BOTH" &&
    !span.conflict &&
    span.riskTier !== "high" &&
    span.llmConfidence !== null &&
    span.llmConfidence !== undefined &&
    span.llmConfidence >= 0.85
  );
}
