import assert from 'node:assert/strict';
import test from 'node:test';
import { detectWithOntology } from '../src/services/detection/ontologyDetector.js';

const rules = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'EMAIL',
    pattern: String.raw`\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`,
    description: 'email',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'ADDRESS',
    pattern: String.raw`\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,5}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Court|Ct|Circle|Cir|Pl|Place)\b\.?`,
    description: 'address',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'NAME',
    pattern: null,
    description: 'name',
  },
];

test('ontology scanner emits rule-linked spans', async () => {
  const text = 'Email john@example.com about 123 Main St. Later, call John Smith for approval.';
  const spans = await detectWithOntology(text, rules);

  assert.ok(spans.some((span) => span.type === 'EMAIL' && span.ontologyRuleId === rules[0].id));
  assert.ok(spans.some((span) => span.type === 'ADDRESS' && span.ontologyRuleId === rules[1].id));
  assert.ok(spans.some((span) => span.type === 'NAME' && span.text === 'John Smith'));
});
