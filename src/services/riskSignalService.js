const { NlpAnalysisSentimentAnalyzer, NlpEventClassifier } = require('../risk/signalAnalyzers');
const { WeightedImpactScorer } = require('../risk/impactScorer');
const { buildFinancialRiskSignal } = require('../domain/RiskSignal');

class RiskSignalService {
  constructor({ eventRepository, analysisRepository, riskRepository, sentimentAnalyzer, eventClassifier, impactScorer } = {}) {
    this.eventRepository = eventRepository;
    this.analysisRepository = analysisRepository;
    this.riskRepository = riskRepository;
    this.sentimentAnalyzer = sentimentAnalyzer || new NlpAnalysisSentimentAnalyzer();
    this.eventClassifier = eventClassifier || new NlpEventClassifier();
    this.impactScorer = impactScorer || new WeightedImpactScorer();
  }

  generateForEvent(eventId) {
    const event = this.eventRepository.findById(eventId);
    if (!event) {
      const error = new Error(`Event not found: ${eventId}`);
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }
    const analysis = this.analysisRepository.findByEventId(eventId);
    if (!analysis || analysis.status === 'failed') {
      const error = new Error(`Successful NLP analysis not found for event: ${eventId}`);
      error.statusCode = 409;
      error.code = 'ANALYSIS_NOT_FOUND';
      throw error;
    }

    const resolved = (analysis.resolved_entities || [])
      .filter((item) => item.entity_type === 'company')
      .sort((a, b) => b.confidence - a.confidence);
    const extracted = (analysis.entities || []).filter((item) => item.type === 'company');
    const entitiesByName = new Map();
    [...resolved, ...extracted].forEach((item) => {
      const name = String(item.canonical_name || item.value).trim().toLowerCase();
      const mention = String(item.original_text || item.value || '').trim().toLowerCase();
      if (name && !entitiesByName.has(name) && !entitiesByName.has(mention)) entitiesByName.set(mention || name, item);
      if (name) entitiesByName.set(name, entitiesByName.get(mention) || entitiesByName.get(name) || item);
    });
    if (!entitiesByName.size) {
      const fallback = event.metadata?.company || event.entity || null;
      entitiesByName.set(String(fallback || 'unknown entity').toLowerCase(), fallback);
    }
    const sentiment = this.sentimentAnalyzer.analyze(analysis, event);
    const classification = this.eventClassifier.classify(analysis, event);
    const previous = this.riskRepository.findByEventId(eventId).filter((signal) => signal.signal_id);
    const existingById = new Map(previous.map((signal) => [signal.signal_id, signal]));
    let created = false;
    const uniqueEntities = [...new Set(entitiesByName.values())];
    const signals = uniqueEntities.map((entity) => {
      const impact = this.impactScorer.score({ analysis, classification, sentiment, event, entity });
      const signal = buildFinancialRiskSignal({ event, analysis, entity, sentiment, classification, impact });
      const existing = existingById.get(signal.signal_id);
      if (existing) return existing;
      this.riskRepository.save(signal);
      created = true;
      return signal;
    });
    return { signal: signals[0], signals, created, reused: !created };
  }

  getForEvent(eventId) {
    const signals = this.getAllForEvent(eventId);
    return signals[0];
  }

  getAllForEvent(eventId) {
    const signals = this.riskRepository.findByEventId(eventId).filter((item) => item.signal_id);
    if (!signals.length) {
      const error = new Error(`Risk signal not found for event: ${eventId}`);
      error.statusCode = 404;
      error.code = 'SIGNAL_NOT_FOUND';
      throw error;
    }
    return signals;
  }

  list(filters = {}) {
    const minImpact = filters.min_impact_score === undefined ? null : Number(filters.min_impact_score);
    if (minImpact !== null && (!Number.isFinite(minImpact) || minImpact < 1 || minImpact > 10)) {
      const error = new Error('min_impact_score must be between 1 and 10.');
      error.statusCode = 400;
      error.code = 'INVALID_FILTER';
      throw error;
    }
    const entity = String(filters.entity || filters.company || '').trim().toLowerCase();
    const classification = String(filters.event_classification || '').trim().toLowerCase();
    const label = String(filters.sentiment_label || '').trim().toLowerCase();
    if (label && !['positive', 'neutral', 'negative'].includes(label)) {
      const error = new Error('sentiment_label must be positive, neutral, or negative.');
      error.statusCode = 400;
      error.code = 'INVALID_FILTER';
      throw error;
    }
    const limit = Number(filters.limit) || 100;
    const signals = this.riskRepository.findAll()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .filter((signal) => signal.signal_id)
      .filter((signal) => !entity || String(signal.entity).toLowerCase().includes(entity))
      .filter((signal) => !classification || signal.event_classification.toLowerCase() === classification)
      .filter((signal) => minImpact === null || signal.impact_score >= minImpact)
      .filter((signal) => !label || signal.sentiment_label === label);
    return signals.slice(0, Math.max(1, Math.min(500, limit)));
  }
}

module.exports = { RiskSignalService };
