import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestWeightProgress } from '../src/utils/workoutProgress.js';

test('compares a new weight with the immediately previous valid log', () => {
  const progress = getLatestWeightProgress([
    { weight: '62.5' },
    { weight: '60' },
    { weight: '55' },
    { weight: '50' },
    { weight: '45' },
    { weight: '40' },
    { weight: '35' },
  ]);

  assert.deepEqual(progress, {
    current: 62.5,
    previous: 60,
    hasComparison: true,
  });
});

test('does not show a comparison until two valid weights exist', () => {
  assert.deepEqual(getLatestWeightProgress([{ weight: '62.5' }]), {
    current: 62.5,
    previous: null,
    hasComparison: false,
  });
  assert.deepEqual(getLatestWeightProgress([]), {
    current: 0,
    previous: null,
    hasComparison: false,
  });
});

test('skips malformed weights while preserving newest-first order', () => {
  assert.deepEqual(getLatestWeightProgress([
    { weight: 'invalid' },
    { weight: '62.5' },
    { weight: null },
    { weight: 60 },
  ]), {
    current: 62.5,
    previous: 60,
    hasComparison: true,
  });
});
