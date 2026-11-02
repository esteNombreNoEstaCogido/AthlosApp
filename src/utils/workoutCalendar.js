export const parseWorkoutLogDate = (dateStr, referenceDate = new Date()) => {
  if (typeof dateStr !== 'string' || !dateStr) return null;
  const parts = dateStr.split('/').map(Number);
  if (parts.length !== 2 && parts.length !== 3) return null;

  const [day, month, rawYear] = parts;
  const year = parts.length === 2
    ? referenceDate.getFullYear()
    : rawYear < 100 ? 2000 + rawYear : rawYear;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

export const toLocalDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getTrainingDateKeys = (workoutLogs, trainingDaysHistory = []) => {
  const keys = new Set();
  Object.values(workoutLogs || {}).forEach(logs => {
    if (!Array.isArray(logs)) return;
    logs.forEach(entry => {
      const date = parseWorkoutLogDate(entry?.date);
      if (date) keys.add(toLocalDateKey(date));
    });
  });
  (Array.isArray(trainingDaysHistory) ? trainingDaysHistory : []).forEach(dateKey => {
    if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const date = new Date(`${dateKey}T00:00:00`);
    if (!Number.isNaN(date.getTime()) && toLocalDateKey(date) === dateKey) keys.add(dateKey);
  });
  return keys;
};

export const recordTrainingDay = (history, dateKey, maxDays = 1825) => {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return Array.isArray(history) ? history : [];
  return [...new Set([...(Array.isArray(history) ? history : []), dateKey])].sort().slice(-maxDays);
};

export const buildMonthCalendarDays = (year, month) => {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
};

export const getWeeklyGoalProgress = (daysThisWeek, configuredGoal) => {
  const goal = Math.min(7, Math.max(1, Number(configuredGoal) || 3));
  const completed = Math.max(0, Number(daysThisWeek) || 0);
  return {
    goal,
    completed,
    percent: Math.min(100, Math.round((completed / goal) * 100)),
    remaining: Math.max(0, goal - completed),
    achieved: completed >= goal,
  };
};