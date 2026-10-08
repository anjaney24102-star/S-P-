const { v4: uuidv4 } = require('uuid');

const buildNLPAnalysis = ({
  eventId,
  entities = [],
  resolved_entities = [],
  topics = [],
  sentimentScore = 0,
  sentimentLabel = 'neutral',
  financialRelevance = 0,
  eventTypes = [],
  evidence = [],
  modelName = 'baseline-rule-based',
  modelVersion = '1.0.0',
  status = 'processed',
}) => ({
  id: uuidv4(),
  event_id: eventId,
  entities,
  resolved_entities,
  topics,
  sentiment_score: Number(sentimentScore || 0),
  sentiment_label: sentimentLabel,
  financial_relevance: Number(financialRelevance || 0),
  event_types: eventTypes,
  evidence,
  model_name: modelName,
  model_version: modelVersion,
  processed_at: new Date().toISOString(),
  status,
});

module.exports = {
  buildNLPAnalysis,
};
