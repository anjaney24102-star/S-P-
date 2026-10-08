const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  baselineDays: 30,
  minimumBaselineSignals: 5,
  minimumBaselineActiveDays: 3,
  minimumIndependentSources: 2,
  minimumStoriesForSpike: 2,
  minimumStoriesForSourceVolume: 2,
  minimumZScore: 2,
  severityThresholds: { WATCH: 2, ELEVATED: 2.5, HIGH: 3.5, CRITICAL: 5 },
  ewmaAlpha: 0.3,
  cooldownMs: 60 * 60 * 1000,
  dayMs: DAY_MS,
};
