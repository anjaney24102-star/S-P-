const { v4: uuidv4 } = require('uuid');

const normalizeSourceName = (sourceName) => String(sourceName || '').trim().toLowerCase();

const buildSourceProfile = ({
  sourceName,
  sourceType = 'unknown',
  credibilityScore = 0.35,
  historicalAccuracy = null,
  verificationStatus = 'unverified',
  createdAt,
  updatedAt,
}) => {
  const normalizedName = normalizeSourceName(sourceName);
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    source_name: normalizedName,
    source_type: sourceType,
    credibility_score: Number(credibilityScore),
    historical_accuracy: historicalAccuracy === null || historicalAccuracy === undefined ? null : Number(historicalAccuracy),
    verification_status: verificationStatus,
    created_at: createdAt || now,
    updated_at: updatedAt || createdAt || now,
  };
};

module.exports = {
  buildSourceProfile,
  normalizeSourceName,
};
