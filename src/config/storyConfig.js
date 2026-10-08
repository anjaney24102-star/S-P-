const storyConfig = {
  similarityThreshold: 0.62,
  nearDuplicateThreshold: 0.8,
  maxStoryWindowMs: 1000 * 60 * 60 * 24 * 7,
  maxTemporalGapHours: 72,
  entityWeight: 0.28,
  textWeight: 0.35,
  topicWeight: 0.17,
  eventTypeWeight: 0.12,
  timeWeight: 0.08,
  minConfidence: 0.5,
};

module.exports = { storyConfig };
