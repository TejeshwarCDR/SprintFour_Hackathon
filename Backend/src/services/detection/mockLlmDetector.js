import { normalizeEndOffset } from '../../utils/offsets.js';

const MOCK_PATTERNS = [
  { type: 'NAME', regex: /\bJohn Smith\b/g, confidence: 0.91, rationale: 'Full personal name appearing as the subject of the document. High confidence this refers to a real individual.' },
  { type: 'EMAIL', regex: /\bjohn\.smith@example\.com\b/gi, confidence: 0.96, rationale: 'Valid email address in personal name format. Both detection layers matched this span.' },
  { type: 'PHONE', regex: /\b(?:\+1[-.\s]?)?\(?555\)?[-.\s]?123[-.\s]?4567\b/g, confidence: 0.89, rationale: 'US phone number in standard format. High confidence it is a direct-contact personal number.' },
  { type: 'SSN', regex: /\b123-45-6789\b/g, confidence: 0.98, rationale: 'US Social Security Number in the standard NNN-NN-NNNN format. Highly sensitive personal identifier.' },
  { type: 'FINANCIAL_ACCOUNT', regex: /\b000111222333444\b/g, confidence: 0.87, rationale: 'Long numeric sequence consistent with a financial account number.' },
];

export const detectWithMockLlm = async (text) => {
  const spans = [];

  for (const pattern of MOCK_PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const { start, end } = normalizeEndOffset(text, match.index, match.index + match[0].length);
      spans.push({
        text: text.slice(start, end),
        start,
        end,
        type: pattern.type,
        confidence: pattern.confidence,
        rationale: pattern.rationale,
      });
    }
  }

  if (spans.length > 0) return spans;

  const fallback = 'John Smith';
  const fallbackIndex = text.indexOf(fallback);
  if (fallbackIndex >= 0) {
    return [{
      text: fallback,
      start: fallbackIndex,
      end: fallbackIndex + fallback.length,
      type: 'NAME',
      confidence: 0.9,
      rationale: 'Personal name identified as the subject of the document.',
    }];
  }

  return [];
};
