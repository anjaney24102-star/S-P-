const { v4: uuidv4 } = require('uuid');

const buildRiskSignal = ({
  entity,
  entityId = null,
  storyId = null,
  eventId,
  riskScore,
  riskLevel,
  confidence,
  riskFactors,
  explanation,
  source,
  eventType,
  sector,
  createdAt,
}) => ({
  id: uuidv4(),
  entity,
  entity_id: entityId,
  story_id: storyId,
  event_id: eventId,
  risk_score: Number(riskScore),
  risk_level: riskLevel,
  confidence: Number(confidence),
  risk_factors: riskFactors,
  explanation,
  source: source || 'unknown',
  event_type: eventType || 'general_financial_event',
  sector: sector || null,
  created_at: createdAt || new Date().toISOString(),
});

module.exports = { buildRiskSignal };
