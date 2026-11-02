import test from 'node:test';
import assert from 'node:assert/strict';
import { appendExerciseToWorkoutDay, removeExerciseFromWorkoutDay } from '../src/utils/workoutExercises.js';

const profile = {
  username: 'test-client',
  workoutData: {
    days: [
      { id: 12, title: 'Piernas', exercises: [{ name: 'Sentadilla' }, { name: 'Prensa' }] },
      { id: 13, title: 'Espalda', exercises: [] }
    ]
  }
};

test('adds an exercise to the selected day without mutating the profile', () => {
  const result = appendExerciseToWorkoutDay(profile, '12', { name: 'Peso muerto' });

  assert.deepEqual(result.workoutData.days[0].exercises.map(exercise => exercise.name), ['Sentadilla', 'Prensa', 'Peso muerto']);
  assert.deepEqual(profile.workoutData.days[0].exercises.map(exercise => exercise.name), ['Sentadilla', 'Prensa']);
  assert.equal(result.workoutData.days[1], profile.workoutData.days[1]);
});

test('rejects adding to a day that no longer exists', () => {
  assert.equal(appendExerciseToWorkoutDay(profile, 99, { name: 'Peso muerto' }), null);
});

test('removes exactly the selected exercise without mutating other days', () => {
  const result = removeExerciseFromWorkoutDay(profile, '12', 0);

  assert.deepEqual(result.workoutData.days[0].exercises.map(exercise => exercise.name), ['Prensa']);
  assert.equal(result.workoutData.days[1], profile.workoutData.days[1]);
  assert.equal(profile.workoutData.days[0].exercises.length, 2);
});

test('removing the second exercise in a superset clears the remaining pair flag', () => {
  const supersetProfile = {
    workoutData: {
      days: [{ id: 12, exercises: [{ name: 'Press', superset: true }, { name: 'Aperturas' }, { name: 'Cruce' }] }]
    }
  };
  const result = removeExerciseFromWorkoutDay(supersetProfile, 12, 1);

  assert.deepEqual(result.workoutData.days[0].exercises, [
    { name: 'Press', superset: false },
    { name: 'Cruce' }
  ]);
  assert.equal(supersetProfile.workoutData.days[0].exercises[0].superset, true);
});

test('rejects invalid exercise indexes and missing days', () => {
  assert.equal(removeExerciseFromWorkoutDay(profile, 12, -1), null);
  assert.equal(removeExerciseFromWorkoutDay(profile, 12, 2), null);
  assert.equal(removeExerciseFromWorkoutDay(profile, 99, 0), null);
});
