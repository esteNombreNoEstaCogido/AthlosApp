import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarDays,
  getTrainingDateKeys,
  getWeeklyGoalProgress,
  parseWorkoutLogDate,
  recordTrainingDay,
  toLocalDateKey,
} from '../src/utils/workoutCalendar.js';

test('parses current and legacy workout date formats', () => {
  assert.equal(toLocalDateKey(parseWorkoutLogDate('09/10/26')), '2026-10-09');
  assert.equal(toLocalDateKey(parseWorkoutLogDate('09/10', new Date(2026, 0, 1))), '2026-10-09');
  assert.equal(parseWorkoutLogDate('31/02/26'), null);
});

test('builds a Monday-first calendar grid including leap days', () => {
  const february2024 = buildMonthCalendarDays(2024, 1);
  assert.equal(february2024.length, 32);
  assert.deepEqual(february2024.slice(0, 4), [null, null, null, 1]);
  assert.equal(february2024.at(-1), 29);

  const october2026 = buildMonthCalendarDays(2026, 9);
  assert.deepEqual(october2026.slice(0, 4), [null, null, null, 1]);
  assert.equal(october2026.filter(day => day !== null).length, 31);
});

test('weekly goal has a calm default and clamps progress', () => {
  assert.deepEqual(getWeeklyGoalProgress(0, 0), {
    goal: 3,
    completed: 0,
    percent: 0,
    remaining: 3,
    achieved: false,
  });
  assert.deepEqual(getWeeklyGoalProgress(2, 5), {
    goal: 5,
    completed: 2,
    percent: 40,
    remaining: 3,
    achieved: false,
  });
  assert.equal(getWeeklyGoalProgress(8, 8).goal, 7);
  assert.equal(getWeeklyGoalProgress(8, 8).percent, 100);
  assert.equal(getWeeklyGoalProgress(8, 8).achieved, true);
});

test('calendar merges legacy logs and retained training-day history without duplicates', () => {
  const year = new Date().getFullYear();
  const monthDay = '09/10';
  const dateKey = `${year}-10-09`;
  const logs = {
    squat: [{ date: `${monthDay}/${String(year).slice(-2)}` }, { date: monthDay }],
    press: [{ date: `${monthDay}/${year}` }],
  };
  const previousDateKey = `${year}-10-08`;
  const history = recordTrainingDay([previousDateKey], dateKey);
  const days = getTrainingDateKeys(logs, history);
  assert.deepEqual([...days].sort(), [previousDateKey, dateKey]);
  assert.deepEqual(recordTrainingDay(history, dateKey), history);
  assert.deepEqual(recordTrainingDay(history, 'invalid'), history);
});