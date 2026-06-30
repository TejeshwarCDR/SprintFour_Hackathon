import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBulkAction, validateSpanAction } from '../src/utils/validation.js';

test('bulk dryRun defaults to true', () => {
  const result = validateBulkAction({
    spanIds: ['11111111-1111-4111-8111-111111111111'],
    action: 'accept',
  });

  assert.equal(result.dryRun, true);
});

test('override requires a valid overrideType', () => {
  assert.throws(() => validateSpanAction({ action: 'override' }), /overrideType is required/);

  const result = validateSpanAction({ action: 'override', overrideType: 'OTHER', actor: 'Sam' });
  assert.equal(result.action, 'override');
  assert.equal(result.overrideType, 'OTHER');
  assert.equal(result.actor, 'Sam');
});
