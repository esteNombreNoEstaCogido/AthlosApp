export const getLatestWeightProgress = logs => {
  const weights = (Array.isArray(logs) ? logs : [])
    .map(log => Number.parseFloat(log?.weight))
    .filter(weight => Number.isFinite(weight) && weight >= 0);

  return {
    current: weights[0] ?? 0,
    previous: weights[1] ?? null,
    hasComparison: weights.length > 1,
  };
};
