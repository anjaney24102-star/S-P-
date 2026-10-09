const { clamp } = require('./signalAnalyzers');

const DEFAULT_IMPACT_CONFIG = {
  weights: { event_severity: 0.38, sentiment_magnitude: 0.16, financial_relevance: 0.16, entity_prominence: 0.12, event_confidence: 0.10, source_reliability: 0.08 },
  severity: { Geopolitical: 0.82, Macroeconomic: 0.70, 'Credit Event': 0.98, 'Merger/Acquisition': 0.72, 'Product Launch': 0.38, Regulatory: 0.78, Legal: 0.76, Earnings: 0.64, 'Supply Chain': 0.72, Cybersecurity: 0.82, Other: 0.30 },
  sourceReliability: { news: 0.82, financial_news: 0.84, major_news: 0.86, manual: 0.70, social: 0.56, social_media: 0.48, twitter: 0.48, x: 0.48, default: 0.50 },
  minimum: 1,
  maximum: 10,
};

class ImpactScorer {
  score() {
    throw new Error('ImpactScorer.score must be implemented.');
  }
}

class WeightedImpactScorer extends ImpactScorer {
  constructor(config = DEFAULT_IMPACT_CONFIG) {
    super();
    this.config = config;
    const total = Object.values(config.weights).reduce((sum, value) => sum + Number(value), 0);
    if (!total || Object.values(config.weights).some((value) => value < 0)) throw new Error('Impact weights must be non-negative and have a positive sum.');
  }

  score({ analysis, classification, sentiment, event, entity }) {
    const w = this.config.weights;
    const source = String(event.source || '').toLowerCase();
    const components = {
      event_severity: clamp(this.config.severity[classification.event_classification] ?? this.config.severity.Other, 0, 1),
      sentiment_magnitude: clamp(Math.abs(sentiment.sentiment_score), 0, 1),
      financial_relevance: clamp(analysis.financial_relevance, 0, 1),
      entity_prominence: clamp(entity ? (entity.confidence ?? 0.78) : 0.30, 0, 1),
      event_confidence: clamp(classification.confidence, 0, 1),
      source_reliability: clamp(this.config.sourceReliability[source] ?? this.config.sourceReliability.default, 0, 1),
    };
    const weightTotal = Object.values(w).reduce((sum, value) => sum + Number(value), 0);
    const weighted = Object.entries(w).reduce((sum, [key, weight]) => sum + components[key] * weight, 0) / weightTotal;
    const score = Math.min(this.config.maximum, Math.max(this.config.minimum, Math.round(this.config.minimum + weighted * (this.config.maximum - this.config.minimum))));
    const impactConfidence = clamp(0.45 + classification.confidence * 0.25 + components.financial_relevance * 0.15 + components.entity_prominence * 0.10 + components.source_reliability * 0.05, 0, 1);
    const reasoning = [
      `Event classified as ${classification.event_classification}`,
      `${components.sentiment_magnitude >= 0.65 ? 'Strong' : components.sentiment_magnitude >= 0.3 ? 'Moderate' : 'Low'} sentiment magnitude (${sentiment.sentiment_label})`,
      `${components.financial_relevance >= 0.7 ? 'High' : components.financial_relevance >= 0.4 ? 'Moderate' : 'Low'} financial relevance`,
      entity ? `Company/entity prominence considered for ${entity.canonical_name || entity.value || entity}` : 'No company/entity was confidently identified',
      `Source reliability set to ${components.source_reliability.toFixed(2)} for ${source || 'unknown'}`,
    ];
    return { impact_score: score, impact_confidence: Number(impactConfidence.toFixed(4)), reasoning, components };
  }
}

module.exports = { ImpactScorer, WeightedImpactScorer, DEFAULT_IMPACT_CONFIG };
