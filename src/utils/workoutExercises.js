export const appendExerciseToWorkoutDay = (profile, dayId, exercise) => {
  if (!profile || dayId === null || dayId === undefined || !exercise) return null;

  const days = Array.isArray(profile.workoutData?.days) ? profile.workoutData.days : [];
  const dayIndex = days.findIndex(day => String(day.id) === String(dayId));
  if (dayIndex < 0) return null;

  const day = days[dayIndex];
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  const updatedDays = [...days];
  updatedDays[dayIndex] = { ...day, exercises: [...exercises, exercise] };

  return {
    ...profile,
    workoutData: { ...profile.workoutData, days: updatedDays }
  };
};

export const removeExerciseFromWorkoutDay = (profile, dayId, exerciseIndex) => {
  if (!profile || dayId === null || dayId === undefined || !Number.isInteger(exerciseIndex) || exerciseIndex < 0) return null;

  const days = Array.isArray(profile.workoutData?.days) ? profile.workoutData.days : [];
  const dayIndex = days.findIndex(day => String(day.id) === String(dayId));
  if (dayIndex < 0) return null;

  const day = days[dayIndex];
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  if (exerciseIndex >= exercises.length) return null;

  const updatedDays = [...days];
  updatedDays[dayIndex] = {
    ...day,
    exercises: exercises
      .filter((_, index) => index !== exerciseIndex)
      .map((exercise, index) => exerciseIndex > 0 && index === exerciseIndex - 1 && exercises[exerciseIndex - 1]?.superset
        ? { ...exercise, superset: false }
        : exercise)
  };

  return {
    ...profile,
    workoutData: { ...profile.workoutData, days: updatedDays }
  };
};
