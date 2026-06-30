import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileSpans } from '../src/services/reconciliation.js';

const documentId = '11111111-1111-4111-8111-111111111111';

test('same-type overlap becomes one non-conflict BOTH span', () => {
  const spans = reconcileSpans({
    documentId,
    llmSpans: [{
      text: 'john@example.com',
      start: 10,
      end: 26,
      type: 'EMAIL',
      confidence: 0.9,
      rationale: 'email',
    }],
    ontologySpans: [{
      text: 'john@example.com',
      start: 10,
      end: 26,
      type: 'EMAIL',
      ontologyRuleId: '22222222-2222-4222-8222-222222222222',
    }],
  });

  assert.equal(spans.length, 1);
  assert.equal(spans[0].source, 'BOTH');
  assert.equal(spans[0].conflict, false);
  assert.equal(spans[0].type, 'EMAIL');
});

test('type conflict preserves both candidates', () => {
  const spans = reconcileSpans({
    documentId,
    llmSpans: [{
      text: 'Jane Doe',
      start: 4,
      end: 12,
      type: 'NAME',
      confidence: 0.65,
      rationale: 'name',
    }],
    ontologySpans: [{
      text: 'Jane Doe',
      start: 4,
      end: 12,
      type: 'OTHER',
      ontologyRuleId: '22222222-2222-4222-8222-222222222222',
    }],
  });

  assert.equal(spans.length, 2);
  assert.deepEqual(new Set(spans.map((span) => span.type)), new Set(['NAME', 'OTHER']));
  assert.ok(spans.every((span) => span.source === 'BOTH'));
  assert.ok(spans.every((span) => span.conflict));
});

test('boundary conflict preserves both boundaries', () => {
  const spans = reconcileSpans({
    documentId,
    llmSpans: [{
      text: 'John',
      start: 0,
      end: 4,
      type: 'NAME',
      confidence: 0.7,
      rationale: 'partial name',
    }],
    ontologySpans: [{
      text: 'John Smith',
      start: 0,
      end: 10,
      type: 'NAME',
      ontologyRuleId: '22222222-2222-4222-8222-222222222222',
    }],
  });

  assert.equal(spans.length, 2);
  assert.deepEqual(new Set(spans.map((span) => `${span.start_offset}-${span.end_offset}`)), new Set(['0-4', '0-10']));
  assert.ok(spans.every((span) => span.conflict));
});

test('unmatched spans keep distinct LLM and ONTOLOGY sources', () => {
  const spans = reconcileSpans({
    documentId,
    llmSpans: [{
      text: 'John Smith',
      start: 0,
      end: 10,
      type: 'NAME',
      confidence: 0.95,
      rationale: 'name',
    }],
    ontologySpans: [{
      text: '123-45-6789',
      start: 20,
      end: 31,
      type: 'SSN',
      ontologyRuleId: '22222222-2222-4222-8222-222222222222',
    }],
  });

  assert.equal(spans.length, 2);
  assert.deepEqual(new Set(spans.map((span) => span.source)), new Set(['LLM', 'ONTOLOGY']));
  assert.equal(spans.find((span) => span.type === 'SSN').risk_tier, 'high');
});
