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

export const setExerciseSuperset = (profile, dayId, exerciseIndex, enabled) => {
  if (!profile || dayId === null || dayId === undefined || !Number.isInteger(exerciseIndex) || exerciseIndex < 0 || typeof enabled !== 'boolean') return null;

  const days = Array.isArray(profile.workoutData?.days) ? profile.workoutData.days : [];
  const dayIndex = days.findIndex(day => String(day.id) === String(dayId));
  if (dayIndex < 0) return null;

  const day = days[dayIndex];
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  if (exerciseIndex >= exercises.length) return null;

  const isSuperset = exercise => exercise?.superset === true || exercise?.superset === 'true';
  if (enabled && (
    exerciseIndex >= exercises.length - 1
    || isSuperset(exercises[exerciseIndex])
    || isSuperset(exercises[exerciseIndex + 1])
    || (exerciseIndex > 0 && isSuperset(exercises[exerciseIndex - 1]))
  )) return null;

  const updatedDays = [...days];
  const updatedExercises = [...exercises];
  updatedExercises[exerciseIndex] = { ...exercises[exerciseIndex], superset: enabled };
  updatedDays[dayIndex] = { ...day, exercises: updatedExercises };

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
