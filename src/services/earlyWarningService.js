const { buildEntityRiskBaseline } = require('../domain/EntityRiskBaseline');
const { buildEarlyWarningSignal } = require('../domain/EarlyWarningSignal');
const defaultConfig = require('../config/earlyWarningConfig');
const { ZScoreAlgorithm, EWMAMeanShiftAlgorithm } = require('../risk/anomalyAlgorithms');

const WINDOW_MS = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
const LEGAL_PATTERN = /regulat|legal|lawsuit|litigation|antitrust|fraud|enforcement|investigation|court|settlement|compliance/;

class EarlyWarningService {
  constructor({ riskRepository, eventRepository, analysisRepository, entityRepository, baselineRepository, warningRepository, alertService, algorithms, config = {}, now = () => Date.now() } = {}) {
    this.riskRepository = riskRepository;
    this.eventRepository = eventRepository;
    this.analysisRepository = analysisRepository;
    this.entityRepository = entityRepository;
    this.baselineRepository = baselineRepository;
    this.warningRepository = warningRepository;
    this.alertService = alertService;
    this.config = { ...defaultConfig, ...config, severityThresholds: { ...defaultConfig.severityThresholds, ...(config.severityThresholds || {}) } };
    this.algorithms = algorithms || [new ZScoreAlgorithm(), new EWMAMeanShiftAlgorithm({ alpha: this.config.ewmaAlpha })];
    this.now = now;
  }

  normalizeWindow(window = '6h') { return Object.prototype.hasOwnProperty.call(WINDOW_MS, String(window).toLowerCase()) ? String(window).toLowerCase() : '6h'; }

  getEntitySignals(entityId) {
    if (this.riskRepository?.findByEntityId) return this.riskRepository.findByEntityId(entityId);
    return (this.riskRepository?.findAll?.() || []).filter((signal) => String(signal.entity_id) === String(entityId));
  }

  getStoryKey(signal) {
    const event = this.eventRepository?.findById(signal.event_id);
    return String(signal.story_id || event?.story_id || signal.event_id || signal.id);
  }

  toStoryRecords(signals) {
    const stories = new Map();
    signals.forEach((signal) => {
      const key = this.getStoryKey(signal);
      const analysis = this.analysisRepository?.findByEventId(signal.event_id) || {};
      const event = this.eventRepository?.findById(signal.event_id) || {};
      const eventTypes = [...(analysis.event_types || []), signal.event_type, event.event_type].filter(Boolean).map((value) => String(value).toLowerCase());
      const factors = (signal.risk_factors || []).map((factor) => String(typeof factor === 'string' ? factor : factor.factor).toLowerCase());
      const sentiment = String(analysis.sentiment_label || '').toLowerCase();
      const negative = sentiment === 'negative' || Number(analysis.sentiment_score || 0) < -0.15 || factors.includes('negative_sentiment');
      const legal = eventTypes.some((value) => LEGAL_PATTERN.test(value));
      const current = stories.get(key) || { key, riskScores: [], sources: new Set(), negative: false, legal: false, eventIds: new Set(), timestamp: signal.created_at || signal.published_at };
      current.riskScores.push(Number(signal.risk_score || 0));
      if (signal.source) current.sources.add(String(signal.source).toLowerCase());
      current.negative ||= negative;
      current.legal ||= legal;
      if (signal.event_id) current.eventIds.add(signal.event_id);
      const date = new Date(signal.created_at || signal.published_at || 0).getTime();
      if (date > new Date(current.timestamp || 0).getTime()) current.timestamp = signal.created_at || signal.published_at;
      stories.set(key, current);
    });
    return [...stories.values()].map((story) => ({
      ...story,
      risk_score: story.riskScores.length ? story.riskScores.reduce((sum, value) => sum + value, 0) / story.riskScores.length : 0,
    }));
  }

  calculateBaseline(entityId, { now = this.now(), window = '6h' } = {}) {
    const entity = this.entityRepository?.findById(entityId);
    const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
    const lookbackMs = Number(this.config.baselineDays) * Number(this.config.dayMs);
    const baselineEnd = nowMs - WINDOW_MS[this.normalizeWindow(window)];
    const baselineStart = baselineEnd - lookbackMs;
    const historical = this.toStoryRecords(this.getEntitySignals(entityId)).filter((story) => {
      const timestamp = new Date(story.timestamp || 0).getTime();
      return timestamp >= baselineStart && timestamp < baselineEnd;
    });
    const days = Math.max(1, Number(this.config.baselineDays));
    const daily = Array.from({ length: days }, () => ({ events: 0, negative: 0, legal: 0, sources: new Set(), riskScores: [] }));
    historical.forEach((story) => {
      const index = Math.floor((new Date(story.timestamp).getTime() - baselineStart) / Number(this.config.dayMs));
      if (index < 0 || index >= daily.length) return;
      const bucket = daily[index];
      bucket.events += 1;
      if (story.negative) bucket.negative += 1;
      if (story.legal) bucket.legal += 1;
      story.sources.forEach((source) => bucket.sources.add(source));
      bucket.riskScores.push(story.risk_score);
    });
    const mean = (items) => items.reduce((sum, value) => sum + value, 0) / Math.max(1, items.length);
    const stdev = (items) => Math.sqrt(mean(items.map((value) => (value - mean(items)) ** 2)));
    const eventRates = daily.map((bucket) => bucket.events);
    const negativeRates = daily.map((bucket) => bucket.negative);
    const legalRates = daily.map((bucket) => bucket.legal);
    const sourceRates = daily.map((bucket) => bucket.sources.size);
    const dailyRisk = daily.filter((bucket) => bucket.riskScores.length).map((bucket) => mean(bucket.riskScores));
    const activeDays = daily.filter((bucket) => bucket.events > 0).length;
    const baseline = buildEntityRiskBaseline({
      entity_id: entityId,
      baseline_risk: historical.length ? mean(historical.map((story) => story.risk_score)) : 0,
      average_event_rate: mean(eventRates),
      average_negative_event_rate: mean(negativeRates),
      standard_deviation: stdev(eventRates),
      calculated_at: new Date(nowMs).toISOString(),
      average_regulatory_legal_rate: mean(legalRates),
      average_source_volume: mean(sourceRates),
      risk_standard_deviation: stdev(dailyRisk),
      sample_days: days,
      active_days: activeDays,
      historical_story_count: historical.length,
      daily_event_rates: eventRates,
      daily_negative_event_rates: negativeRates,
      daily_legal_event_rates: legalRates,
      daily_source_volumes: sourceRates,
      daily_risk_scores: dailyRisk,
      sufficient_history: historical.length >= Number(this.config.minimumBaselineSignals) && activeDays >= Number(this.config.minimumBaselineActiveDays),
    });
    return this.baselineRepository?.save ? this.baselineRepository.save(baseline) : baseline;
  }

  currentMetrics(entityId, window, now = this.now()) {
    const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
    const windowMs = WINDOW_MS[window];
    const start = nowMs - windowMs;
    const stories = this.toStoryRecords(this.getEntitySignals(entityId)).filter((story) => {
      const timestamp = new Date(story.timestamp || 0).getTime();
      return timestamp >= start && timestamp <= nowMs;
    });
    const days = windowMs / Number(this.config.dayMs);
    const distinctSources = new Set(stories.flatMap((story) => [...story.sources]));
    return {
      stories,
      independentSources: distinctSources.size,
      eventRate: stories.length / days,
      negativeRate: stories.filter((story) => story.negative).length / days,
      legalRate: stories.filter((story) => story.legal).length / days,
      sourceRate: stories.reduce((sum, story) => sum + story.sources.size, 0) / days,
      riskScore: stories.length ? stories.reduce((sum, story) => sum + story.risk_score, 0) / stories.length : 0,
    };
  }

  scoreAnomaly(current, samples) {
    return this.algorithms.reduce((best, algorithm) => {
      const score = Number(algorithm.score(current, samples) || 0);
      return score > best.score ? { score, algorithm: algorithm.name || 'custom' } : best;
    }, { score: 0, algorithm: null });
  }

  severityFor(zScore) {
    if (zScore >= this.config.severityThresholds.CRITICAL) return 'CRITICAL';
    if (zScore >= this.config.severityThresholds.HIGH) return 'HIGH';
    if (zScore >= this.config.severityThresholds.ELEVATED) return 'ELEVATED';
    if (zScore >= this.config.severityThresholds.WATCH) return 'WATCH';
    return null;
  }

  formatRate(value) { return Number(value || 0).toFixed(1); }

  makeWarning({ entity, entityId, type, label, baseline, current, score, window, independentSources, storyCount, detectedAt }) {
    const severity = this.severityFor(score);
    if (!severity || current <= baseline || independentSources < Number(this.config.minimumIndependentSources)) return null;
    const percent = baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
    const valueUnit = type === 'RISK_SCORE_SPIKE' ? 'risk points' : 'events/day';
    const changeText = percent === null ? `from a baseline of 0 to ${this.formatRate(current)}` : `from ${this.formatRate(baseline)} to ${this.formatRate(current)} (${Math.round(percent)}% increase)`;
    const explanation = `${label} increased ${changeText} over the ${window} window. Its ${score.toFixed(2)} standard-deviation score is unusual versus the 30-day baseline; ${independentSources} independent sources corroborate ${storyCount} distinct ${storyCount === 1 ? 'story' : 'stories'}. This is an activity anomaly, not a stock-price prediction.`;
    return buildEarlyWarningSignal({
      entity_id: entityId,
      entity,
      warning_type: type,
      severity,
      baseline_value: baseline,
      current_value: current,
      deviation: score,
      confidence: Math.min(0.99, 0.55 + (Math.min(score, 5) * 0.05) + (Math.min(independentSources, 4) * 0.04)),
      detected_at: new Date(detectedAt).toISOString(),
      explanation,
      window,
      metadata: { independent_source_count: independentSources, distinct_story_count: storyCount, value_unit: valueUnit },
    });
  }

  detectEntity(entityId, { window = '6h', now = this.now() } = {}) {
    const normalizedWindow = this.normalizeWindow(window);
    const entity = this.entityRepository?.findById(entityId);
    if (!entity) return [];
    const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
    const baseline = this.calculateBaseline(entityId, { now: nowMs, window: normalizedWindow });
    const current = this.currentMetrics(entityId, normalizedWindow, nowMs);
    if (!baseline.sufficient_history || current.stories.length < Number(this.config.minimumStoriesForSpike)) return [];

    const definitions = [
      { type: 'EVENT_FREQUENCY_SPIKE', label: 'Financial event frequency', value: current.eventRate, samples: baseline.daily_event_rates },
      { type: 'NEGATIVE_SENTIMENT_SPIKE', label: 'Negative financial events', value: current.negativeRate, samples: baseline.daily_negative_event_rates },
      { type: 'RISK_SCORE_SPIKE', label: 'Average risk score', value: current.riskScore, samples: baseline.daily_risk_scores, baseline: baseline.baseline_risk },
      { type: 'REGULATORY_LEGAL_SPIKE', label: 'Regulatory and legal activity', value: current.legalRate, samples: baseline.daily_legal_event_rates },
    ];
    if (current.stories.length >= Number(this.config.minimumStoriesForSourceVolume)) {
      definitions.push({ type: 'SOURCE_VOLUME_SPIKE', label: 'Independent source volume', value: current.sourceRate, samples: baseline.daily_source_volumes });
    }
    const candidates = definitions.map((definition) => {
      const windowDays = WINDOW_MS[normalizedWindow] / Number(this.config.dayMs);
      const isRiskScore = definition.type === 'RISK_SCORE_SPIKE';
      const score = this.scoreAnomaly(isRiskScore ? definition.value : definition.value * windowDays,
        isRiskScore ? definition.samples : definition.samples.map((value) => value * windowDays));
      const baselineValue = definition.baseline ?? (definition.samples.reduce((sum, value) => sum + value, 0) / Math.max(1, definition.samples.length));
      return this.makeWarning({ entity: entity.canonical_name, entityId, type: definition.type, label: definition.label, baseline: baselineValue, current: definition.value, score: score.score, window: normalizedWindow, independentSources: current.independentSources, storyCount: current.stories.length, detectedAt: nowMs });
    }).filter(Boolean);

    return candidates.map((candidate) => {
      const saved = this.warningRepository?.save ? this.warningRepository.save(candidate, { cooldownMs: Number(this.config.cooldownMs) }) : { warning: candidate, created: true };
      if (saved.created && this.alertService?.recordEarlyWarning) this.alertService.recordEarlyWarning(saved.warning);
      return saved.warning;
    });
  }

  getWarnings(options = {}) {
    const entities = this.entityRepository?.findAll() || [];
    entities.forEach((entity) => this.detectEntity(entity.id, { window: options.window || '6h' }));
    const warnings = this.warningRepository?.findAll?.() || [];
    return warnings.filter((warning) => (!options.entity_id || String(warning.entity_id) === String(options.entity_id))
      && (!options.severity || warning.severity === String(options.severity).toUpperCase())
      && (!options.window || warning.window === this.normalizeWindow(options.window)))
      .slice(0, Number(options.limit) || 50);
  }

  getWarningsForEntity(entityId, options = {}) {
    this.detectEntity(entityId, options);
    return (this.warningRepository?.findByEntityId?.(entityId) || []).filter((warning) => !options.window || warning.window === this.normalizeWindow(options.window));
  }

  getBaseline(entityId, options = {}) { return this.calculateBaseline(entityId, options); }
  reset() { this.baselineRepository?.reset?.(); this.warningRepository?.reset?.(); }
}

module.exports = { EarlyWarningService, WINDOW_MS };
