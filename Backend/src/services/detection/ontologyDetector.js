import { normalizeEndOffset } from '../../utils/offsets.js';

const NAME_STOPWORDS = new Set([
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'The', 'This', 'That', 'These', 'Those',
  'Please', 'Dear', 'Regards', 'Sincerely', 'Subject', 'From', 'To',
]);

const isSentenceStart = (text, index) => {
  const before = text.slice(Math.max(0, index - 3), index);
  return index === 0 || /(?:^|[.!?]\s)$/.test(before);
};

const createRegex = (pattern) => new RegExp(pattern, 'gi');

const scanRegexRule = (text, rule) => {
  const spans = [];
  const regex = createRegex(rule.pattern);

  for (const match of text.matchAll(regex)) {
    const rawStart = match.index;
    const rawEnd = match.index + match[0].length;
    const { start, end } = normalizeEndOffset(text, rawStart, rawEnd);
    if (end > start) {
      spans.push({
        text: text.slice(start, end),
        start,
        end,
        type: rule.type,
        ontologyRuleId: rule.id,
        ruleDescription: rule.description,
      });
    }
  }

  return spans;
};

const scanNameRule = (text, rule) => {
  const spans = [];
  const regex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

  for (const match of text.matchAll(regex)) {
    const words = match[0].split(/\s+/);
    if (words.some((word) => NAME_STOPWORDS.has(word.replace(/\.$/, '')))) continue;
    if (isSentenceStart(text, match.index)) continue;

    const { start, end } = normalizeEndOffset(text, match.index, match.index + match[0].length);
    spans.push({
      text: text.slice(start, end),
      start,
      end,
      type: 'NAME',
      ontologyRuleId: rule.id,
      ruleDescription: rule.description,
    });
  }

  return spans;
};

export const detectWithOntology = async (text, rules) => {
  const spans = [];

  for (const rule of rules) {
    // NAME rules without a pattern use the capitalization heuristic scanner.
    // NAME rules with an explicit pattern (e.g. abbreviated formats) use the regex scanner.
    if (rule.type === 'NAME' && !rule.pattern) {
      spans.push(...scanNameRule(text, rule));
      continue;
    }

    if (rule.pattern) {
      spans.push(...scanRegexRule(text, rule));
    }
  }

  return spans.sort((a, b) => a.start - b.start || a.end - b.end);
};
