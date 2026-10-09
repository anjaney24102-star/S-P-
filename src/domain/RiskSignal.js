const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');
const { EVENT_CATEGORIES, clamp } = require('../risk/signalAnalyzers');

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

const buildFinancialRiskSignal = ({ event, analysis, entity, sentiment, classification, impact }) => {
  if (!event?.id || !analysis || !sentiment || !classification || !impact) throw new Error('Event, NLP analysis, and scored signal fields are required.');
  if (!EVENT_CATEGORIES.has(classification.event_classification)) throw new Error('Unsupported event classification.');
  const sentimentScore = clamp(sentiment.sentiment_score, -1, 1);
  const impactScore = Math.round(clamp(impact.impact_score, 1, 10));
  const eventConfidence = clamp(classification.confidence, 0, 1);
  const impactConfidence = clamp(impact.impact_confidence, 0, 1);
  const overallConfidence = Number((eventConfidence * 0.6 + impactConfidence * 0.4).toFixed(4));
  const entityName = entity?.canonical_name || entity?.value || entity || event.entity || event.metadata?.company || 'Unknown entity';
  const id = `sig_${createHash('sha256').update(`${event.id}\0${String(entityName).toLowerCase()}`).digest('hex').slice(0, 20)}`;
  const createdAt = new Date().toISOString();
  return {
    signal_id: id,
    id,
    event_id: event.id,
    entity: entityName,
    company: entityName,
    entity_id: entity?.entity_id || entity?.id || null,
    sentiment_score: Number(sentimentScore.toFixed(4)),
    sentiment_label: sentimentScore > 0.05 ? 'positive' : sentimentScore < -0.05 ? 'negative' : 'neutral',
    event_classification: classification.event_classification,
    event_confidence: Number(eventConfidence.toFixed(4)),
    impact_score: impactScore,
    impact_confidence: Number(impactConfidence.toFixed(4)),
    overall_confidence: overallConfidence,
    confidence: overallConfidence,
    explanation: { impact_score: impactScore, reasoning: impact.reasoning, components: impact.components },
    model_name: analysis.model_name || 'nlp-analysis-risk-signal',
    model_version: analysis.model_version || '1.0.0',
    created_at: createdAt,
    generated_at: createdAt,
  };
};

module.exports.buildFinancialRiskSignal = buildFinancialRiskSignal;
