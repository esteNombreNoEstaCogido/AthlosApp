import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUserData } from '../src/security/validationSchemas.js';

const profileWithFeedback = (feedback) => ({
  username: 'client_1',
  authUid: 'firebase-uid-1',
  name: 'Cliente',
  completedSessionsTotal: 4,
  completedSessions: [{
    id: 1,
    dayId: 12,
    dayTitle: 'Día de fuerza',
    startedAt: '2026-10-30T10:00:00.000Z',
    finishedAt: '2026-10-30T11:00:00.000Z',
    durationSeconds: 3600,
  }],
  exerciseFeedback: [feedback],
});

const validFeedback = {
  id: 2,
  exerciseName: 'Sentadilla',
  dayId: 12,
  dayTitle: 'Día de fuerza',
  reaction: 'change',
  reason: 'pain',
  comment: 'Me molesta la rodilla.',
  createdAt: '2026-10-30T11:00:00.000Z',
  status: 'new',
};

test('accepts a valid session summary and exercise feedback', () => {
  assert.equal(validateUserData(profileWithFeedback(validFeedback)).valid, true);
});

test('rejects unknown feedback reactions and statuses', () => {
  assert.equal(validateUserData(profileWithFeedback({ ...validFeedback, reaction: 'five_stars' })).valid, false);
  assert.equal(validateUserData(profileWithFeedback({ ...validFeedback, status: 'deleted' })).valid, false);
});

test('enforces the profile feedback cap', () => {
  const profile = profileWithFeedback(validFeedback);
  profile.exerciseFeedback = Array.from({ length: 31 }, (_, index) => ({ ...validFeedback, id: index + 1 }));
  assert.equal(validateUserData(profile).valid, false);
});
