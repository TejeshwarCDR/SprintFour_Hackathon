export const DEFAULT_ONTOLOGY_RULES = [
  {
    type: 'EMAIL',
    pattern: String.raw`\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`,
    description: 'Standard email address pattern.',
  },
  {
    type: 'PHONE',
    pattern: String.raw`(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)`,
    description: 'Common US and international phone number formats (digits with optional hyphens, dots, or spaces).',
  },
  {
    type: 'PHONE',
    pattern: String.raw`\b(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:[,\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine)){6,11}\b`,
    description: 'Spoken/spelled-out phone number: sequence of 7–12 digit words (e.g. "five one two, five five five, zero one nine two").',
  },
  {
    type: 'SSN',
    pattern: String.raw`\b(?:\d{3}-\d{2}-\d{4}|(?:ssn|social security|tax id)[^\d]{0,20}\d{9})\b`,
    description: 'Formatted SSN (NNN-NN-NNNN) or unformatted 9-digit number preceded by SSN context words within 20 characters.',
  },
  {
    type: 'FINANCIAL_ACCOUNT',
    pattern: String.raw`\b(?:account|routing|card|acct|iban)[^\d]{0,30}\d(?:[\s-]?\d){11,}\b|\b\d(?:[\s-]?\d){11,}[^\w\n]{0,10}(?:account|routing|card|acct|iban)\b`,
    description: 'Long digit sequence (12+ digits) adjacent to financial context words (account, routing, card, IBAN).',
  },
  {
    type: 'NAME',
    pattern: null,
    description: 'Capitalized multi-word sequences, excluding common stopwords and sentence-leading false positives. Uses structural heuristics rather than a fixed regex.',
  },
  {
    type: 'NAME',
    pattern: String.raw`\b[A-Z][a-z]{1,19},\s+[A-Z]\.?\b`,
    description: 'Abbreviated name format: last name followed by first initial (e.g. "Smith, J." or "Johnson, A").',
  },
  {
    type: 'ADDRESS',
    pattern: String.raw`\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,5}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Court|Ct|Circle|Cir|Pl|Place)\b\.?`,
    description: 'Street address: house number followed by street-like words ending in a recognized suffix (Street, Ave, Road, etc.).',
  },
];
