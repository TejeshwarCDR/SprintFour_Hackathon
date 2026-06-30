export const buildRedactedText = (rawText, spans) => {
  // Sort ascending by start, then descending by end so wider spans come first.
  const sorted = spans
    .filter((span) => span.status === 'accepted' || span.status === 'overridden')
    .sort((a, b) => a.start_offset - b.start_offset || b.end_offset - a.end_offset);

  // Merge overlapping intervals; keep the type of the earliest/widest span.
  const merged = [];
  for (const span of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && span.start_offset < prev.end_offset) {
      // Overlap or containment — extend the previous interval if needed.
      prev.end_offset = Math.max(prev.end_offset, span.end_offset);
    } else {
      merged.push({ ...span });
    }
  }

  // Apply in reverse order so earlier offsets are not shifted.
  let output = rawText;
  for (let i = merged.length - 1; i >= 0; i--) {
    const span = merged[i];
    const mask = `[REDACTED:${span.type}]`;
    output = `${output.slice(0, span.start_offset)}${mask}${output.slice(span.end_offset)}`;
  }

  return output;
};
