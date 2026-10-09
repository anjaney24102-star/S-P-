const { EVENT_CATEGORIES, clamp } = require('../risk/signalAnalyzers');

const SENTIMENT_LABELS = new Set(['positive', 'neutral', 'negative']);

class SignalOutputService {
  constructor({ riskRepository, eventRepository, entityRepository } = {}) {
    this.riskRepository = riskRepository;
    this.eventRepository = eventRepository;
    this.entityRepository = entityRepository;
  }

  invalid(message) {
    const error = new Error(message);
    error.statusCode = 400;
    error.code = 'INVALID_PARAMETER';
    throw error;
  }

  parseFilters(query = {}, entityFilter = null) {
    const integer = (name, value, fallback, min, max) => {
      if (value === undefined) return fallback;
      if (!/^\d+$/.test(String(value))) this.invalid(`${name} must be an integer.`);
      const parsed = Number(value);
      if (parsed < min || parsed > max) this.invalid(`${name} must be between ${min} and ${max}.`);
      return parsed;
    };
    const page = integer('page', query.page, 1, 1, 1000000);
    const limit = integer('limit', query.limit, 20, 1, 100);
    const minImpactValue = query.min_impact_score ?? query.min_impact;
    const minImpact = integer('min_impact_score', minImpactValue, null, 1, 10);
    const sentiment = String(query.sentiment ?? query.sentiment_label ?? '').trim().toLowerCase();
    if (sentiment && !SENTIMENT_LABELS.has(sentiment)) this.invalid('sentiment must be positive, neutral, or negative.');
    const classification = String(query.event_classification || '').trim();
    if (classification && ![...EVENT_CATEGORIES].some((item) => item.toLowerCase() === classification.toLowerCase())) {
      this.invalid('event_classification is not supported.');
    }
    const dateValue = (name, value) => {
      if (value === undefined || value === '') return null;
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) this.invalid(`${name} must be a valid ISO-8601 date/time.`);
      return new Date(value).getTime();
    };
    const from = dateValue('from', query.from ?? query.start_date);
    const to = dateValue('to', query.to ?? query.end_date);
    if (from !== null && to !== null && from > to) this.invalid('from must be earlier than or equal to to.');
    return {
      page, limit,
      company: String(entityFilter ?? query.company ?? query.entity ?? '').trim().toLowerCase(),
      source: String(query.source || '').trim().toLowerCase(),
      eventClassification: classification.toLowerCase(),
      sentiment,
      minImpact,
      from,
      to,
    };
  }

  entityFor(signal) {
    if (!this.entityRepository) return null;
    if (signal.entity_id) {
      const direct = this.entityRepository.findById(signal.entity_id);
      if (direct) return direct;
    }
    const needle = String(signal.entity || '').toLowerCase();
    return this.entityRepository.findAll().find((entity) =>
      [entity.canonical_name, entity.ticker, ...(entity.aliases || [])].some((value) => String(value || '').toLowerCase() === needle)) || null;
  }

  serialize(signal) {
    const event = this.eventRepository?.findById(signal.event_id);
    const entity = this.entityFor(signal);
    const score = Number.isFinite(Number(signal.sentiment_score)) ? clamp(signal.sentiment_score, -1, 1) : 0;
    const label = SENTIMENT_LABELS.has(signal.sentiment_label)
      ? signal.sentiment_label
      : score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral';
    const timestampValue = signal.generated_at || signal.created_at || event?.published_at;
    const parsedTime = timestampValue ? new Date(timestampValue) : new Date(0);
    const timestamp = Number.isNaN(parsedTime.getTime()) ? new Date(0).toISOString() : parsedTime.toISOString();
    const reasoning = Array.isArray(signal.explanation)
      ? signal.explanation
      : Array.isArray(signal.explanation?.reasoning) ? signal.explanation.reasoning : [];
    const rawImpact = Number(signal.impact_score);
    const impactScore = Math.round(clamp(Number.isFinite(rawImpact) ? rawImpact : 1, 1, 10));
    const numberOrZero = (value) => Number.isFinite(Number(value)) ? clamp(value, 0, 1) : 0;
    return {
      signal_id: String(signal.signal_id),
      event_id: String(signal.event_id),
      timestamp,
      source: String(signal.source || event?.source || 'unknown'),
      company: {
        name: String(entity?.canonical_name || signal.company || signal.entity || 'Unknown entity'),
        ticker: entity?.ticker ? String(entity.ticker) : null,
      },
      sentiment: { score: Number(score.toFixed(4)), label },
      event: {
        classification: EVENT_CATEGORIES.has(signal.event_classification) ? signal.event_classification : 'Other',
        confidence: numberOrZero(signal.event_confidence),
      },
      impact: { score: impactScore, confidence: numberOrZero(signal.impact_confidence) },
      overall_confidence: numberOrZero(signal.overall_confidence ?? signal.confidence),
      explanation: reasoning.map((line) => String(line)),
    };
  }

  list(query = {}, entityFilter = null) {
    const filters = this.parseFilters(query, entityFilter);
    const signals = this.riskRepository.findAll()
      .filter((signal) => signal.signal_id)
      .map((signal) => this.serialize(signal))
      .filter((signal) => !filters.company || [signal.company.name, signal.company.ticker].some((value) => String(value || '').toLowerCase().includes(filters.company)))
      .filter((signal) => !filters.source || signal.source.toLowerCase() === filters.source)
      .filter((signal) => !filters.eventClassification || signal.event.classification.toLowerCase() === filters.eventClassification)
      .filter((signal) => !filters.sentiment || signal.sentiment.label === filters.sentiment)
      .filter((signal) => filters.minImpact === null || signal.impact.score >= filters.minImpact)
      .filter((signal) => filters.from === null || Date.parse(signal.timestamp) >= filters.from)
      .filter((signal) => filters.to === null || Date.parse(signal.timestamp) <= filters.to)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const offset = (filters.page - 1) * filters.limit;
    return {
      data: signals.slice(offset, offset + filters.limit),
      meta: { page: filters.page, limit: filters.limit, total: signals.length },
    };
  }

  getById(signalId) {
    const signal = this.riskRepository.findAll().find((item) => item.signal_id === signalId);
    if (!signal) {
      const error = new Error('Risk signal was not found.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    return this.serialize(signal);
  }
}

module.exports = { SignalOutputService };
