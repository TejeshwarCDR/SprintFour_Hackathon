import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRedactedText } from '../src/utils/redaction.js';

test('redacts accepted and overridden spans only', () => {
  const text = 'John Smith has SSN 123-45-6789.';
  const output = buildRedactedText(text, [
    { start_offset: 0, end_offset: 10, type: 'NAME', status: 'accepted' },
    { start_offset: 19, end_offset: 30, type: 'SSN', status: 'pending' },
  ]);

  assert.equal(output, '[REDACTED:NAME] has SSN 123-45-6789.');
});
