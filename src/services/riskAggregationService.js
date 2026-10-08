const { aggregation: aggregationConfig } = require('../config/riskConfig');
const { buildEmergingRisk } = require('../domain/EmergingRisk');

class RiskAggregationService {
  constructor({ riskRepository, entityResolutionService, config = aggregationConfig } = {}) {
    this.riskRepository = riskRepository;
    this.entityResolutionService = entityResolutionService;
    this.config = config;
  }

  normalizeWindow(windowKey) {
    const key = String(windowKey || '24h').toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.config.windows, key) ? key : '24h';
  }

  getWindowMs(windowKey) {
    return this.config.windows[this.normalizeWindow(windowKey)] || this.config.windows['24h'];
  }

  filterSignalsByWindow(signals = [], windowKey = '24h', now = Date.now()) {
    const windowMs = this.getWindowMs(windowKey);
    const cutoff = now - windowMs;

    return signals.filter((signal) => {
      const timestamp = new Date(signal.created_at || signal.published_at || Date.now()).getTime();
      return timestamp >= cutoff && timestamp <= now;
    });
  }

  getPreviousWindowSignals(signals = [], windowKey = '24h', now = Date.now()) {
    const windowMs = this.getWindowMs(windowKey);
    const currentStart = now - windowMs;
    const previousStart = currentStart - windowMs;

    return signals.filter((signal) => {
      const timestamp = new Date(signal.created_at || signal.published_at || Date.now()).getTime();
      return timestamp >= previousStart && timestamp < currentStart;
    });
  }

  getAllSignals() {
    if (!this.riskRepository) return [];

    if (typeof this.riskRepository.findAll === 'function') {
      return this.riskRepository.findAll();
    }

    if (typeof this.riskRepository.findSignalsByEntity === 'function') {
      const signals = this.riskRepository.findSignalsByEntity('');
      if (Array.isArray(signals) && signals.length) return signals;
    }

    if (Array.isArray(this.riskRepository.signals)) {
      return this.riskRepository.signals;
    }

    if (this.riskRepository.byEntity && typeof this.riskRepository.byEntity.values === 'function') {
      return [...this.riskRepository.byEntity.values()].flat();
    }

    if (this.riskRepository.byEntity instanceof Map) {
      return [...this.riskRepository.byEntity.values()].flat();
    }

    return [];
  }

  getSignalsForEntity(entityName) {
    const resolved = this.entityResolutionService?.resolve(entityName)?.resolved_entity;
    if (resolved && typeof this.riskRepository?.findByEntityId === 'function') return this.riskRepository.findByEntityId(resolved.id);
    return typeof this.riskRepository?.findSignalsByEntity === 'function' ? this.riskRepository.findSignalsByEntity(entityName) : [];
  }

  getSignalFactors(signal) {
    if (!signal || !Array.isArray(signal.risk_factors)) return [];
    return signal.risk_factors
      .map((factor) => (typeof factor === 'string' ? factor : factor.factor))
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
  }

  getDominantFactors(signals = []) {
    const counts = new Map();
    signals.forEach((signal) => {
      this.getSignalFactors(signal).forEach((factor) => {
        counts.set(factor, (counts.get(factor) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([factor]) => factor);
  }

  classifyTrend(delta) {
    if (delta <= -15) return 'IMPROVING';
    if (Math.abs(delta) < 5) return 'STABLE';
    if (delta >= 10 && delta < 25) return 'DETERIORATING';
    if (delta >= 25) return 'RAPIDLY_DETERIORATING';
    return 'DETERIORATING';
  }

  buildEntitySummary(entityName, signals, windowKey) {
    const currentSignals = this.filterSignalsByWindow(signals, windowKey);
    const previousSignals = this.getPreviousWindowSignals(signals, windowKey);
    const currentRiskScore = currentSignals.length
      ? Math.max(...currentSignals.map((signal) => Number(signal.risk_score || 0)))
      : 0;
    const previousRiskScore = previousSignals.length
      ? Math.max(...previousSignals.map((signal) => Number(signal.risk_score || 0)))
      : 0;
    const riskDelta = Number((currentRiskScore - previousRiskScore).toFixed(1));
    const numberOfRiskEvents = currentSignals.length;
    const uniqueSources = new Set(currentSignals.map((signal) => signal.source).filter(Boolean));
    const negativeEventCount = currentSignals.filter((signal) => Number(signal.risk_score || 0) >= this.config.thresholds.strongNegativeThreshold).length;
    const positiveEventCount = currentSignals.filter((signal) => Number(signal.risk_score || 0) < this.config.thresholds.positiveThreshold).length;
    const dominantFactors = this.getDominantFactors(currentSignals);
    const confidence = Math.min(1, Math.max(0.2, 0.35 + (uniqueSources.size * 0.12) + (currentRiskScore / 200) + (numberOfRiskEvents * 0.04)));

    return {
      entity: entityName,
      current_risk_score: Number(currentRiskScore.toFixed(1)),
      previous_risk_score: Number(previousRiskScore.toFixed(1)),
      risk_delta: riskDelta,
      number_of_risk_events: numberOfRiskEvents,
      number_of_independent_sources: uniqueSources.size,
      negative_event_count: negativeEventCount,
      positive_event_count: positiveEventCount,
      risk_trend: this.classifyTrend(riskDelta),
      confidence: Number(confidence.toFixed(2)),
      dominant_risk_factors: dominantFactors,
      signal_count: numberOfRiskEvents,
      window: this.normalizeWindow(windowKey),
    };
  }

  getEntityRiskSummary(entityName, options = {}) {
    if (!this.riskRepository) {
      return {
        entity: entityName,
        current_risk_score: 0,
        previous_risk_score: 0,
        risk_delta: 0,
        number_of_risk_events: 0,
        number_of_independent_sources: 0,
        negative_event_count: 0,
        positive_event_count: 0,
        risk_trend: 'STABLE',
        confidence: 0,
        dominant_risk_factors: [],
        signal_count: 0,
        window: this.normalizeWindow(options.window),
      };
    }

    const resolution = this.entityResolutionService?.resolve(entityName);
    const canonicalName = resolution?.resolved_entity?.canonical_name || entityName;
    const signals = this.getSignalsForEntity(entityName);

    if (!signals.length) {
      return {
        entity: entityName,
        current_risk_score: 0,
        previous_risk_score: 0,
        risk_delta: 0,
        number_of_risk_events: 0,
        number_of_independent_sources: 0,
        negative_event_count: 0,
        positive_event_count: 0,
        risk_trend: 'STABLE',
        confidence: 0,
        dominant_risk_factors: [],
        signal_count: 0,
        window: this.normalizeWindow(options.window),
      };
    }

    return this.buildEntitySummary(canonicalName, signals, options.window || '24h');
  }

  getEntityRiskHistory(entityName, options = {}) {
    const resolved = this.entityResolutionService?.resolve(entityName)?.resolved_entity;
    const canonicalName = resolved?.canonical_name || entityName;
    const signals = this.getSignalsForEntity(entityName);

    if (!signals.length) {
      return [];
    }

    const sorted = [...signals].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const windowKey = this.normalizeWindow(options.window || '24h');
    const buckets = new Map();

    sorted.forEach((signal) => {
      const date = new Date(signal.created_at || signal.published_at || Date.now());
      const bucketStart = new Date(date.getTime() - (date.getTime() % this.getWindowMs(windowKey)));
      const bucketKey = bucketStart.toISOString();
      const existing = buckets.get(bucketKey) || [];
      existing.push(signal);
      buckets.set(bucketKey, existing);
    });

    return [...buckets.entries()].map(([timestamp, bucketSignals]) => {
      const summary = this.buildEntitySummary(canonicalName, bucketSignals, windowKey);
      return {
        timestamp,
        risk_score: summary.current_risk_score,
        signal_count: summary.number_of_risk_events,
        independent_sources: summary.number_of_independent_sources,
        risk_trend: summary.risk_trend,
      };
    });
  }

  correlateSignals(entityName, options = {}) {
    const resolved = this.entityResolutionService?.resolve(entityName)?.resolved_entity;
    const canonicalName = resolved?.canonical_name || entityName;
    const signals = this.getSignalsForEntity(entityName);

    const sorted = [...signals].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const clusters = [];
    const maxGapMs = Number(options.maxGapMs || 1000 * 60 * 60 * 12);

    sorted.forEach((signal) => {
      let cluster = clusters.find((item) => {
        const sameEntity = String(item.entity_id || item.entity).toLowerCase() === String(signal.entity_id || canonicalName).toLowerCase();
        const sameEventType = item.event_type === signal.event_type;
        const sameFactor = this.getSignalFactors(item).some((factor) => this.getSignalFactors(signal).includes(factor));
        const timeGap = Math.abs(new Date(signal.created_at).getTime() - new Date(item.last_timestamp).getTime());
        return sameEntity && (sameEventType || sameFactor) && timeGap <= maxGapMs;
      });

      if (!cluster) {
        cluster = {
          entity: signal.entity || canonicalName,
          entity_id: signal.entity_id || resolved?.id || null,
          event_type: signal.event_type || 'general_financial_event',
          window_hours: 12,
          signals: [],
          last_timestamp: signal.created_at,
        };
        clusters.push(cluster);
      }

      cluster.signals.push(signal);
      cluster.last_timestamp = new Date(signal.created_at).toISOString();
    });

    return clusters
      .filter((cluster) => cluster.signals.length > 0)
      .map((cluster) => ({
        entity: cluster.entity,
        event_type: cluster.event_type,
        signal_count: cluster.signals.length,
        sources: [...new Set(cluster.signals.map((signal) => signal.source))],
        window_hours: cluster.window_hours,
        signals: cluster.signals,
        clustered_risk_score: Math.max(...cluster.signals.map((signal) => Number(signal.risk_score || 0))),
      }));
  }

  getEmergingRisks(options = {}) {
    const signals = this.getAllSignals();
    if (!signals.length) {
      return [];
    }

    const grouped = new Map();
    signals.forEach((signal) => {
      const key = String(signal.entity_id || signal.entity || 'Unknown entity').toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(signal);
    });

    const windowKey = this.normalizeWindow(options.window || '24h');
    const emerging = [];

    grouped.forEach((entitySignals, entityKey) => {
      const summary = this.buildEntitySummary(entitySignals[0]?.entity || entityKey, entitySignals, windowKey);
      const meetsThreshold = summary.number_of_risk_events >= (options.minSignals || this.config.thresholds.minEmergingSignals)
        && summary.current_risk_score >= (options.minRiskScore || this.config.thresholds.minEmergingRiskScore)
        && summary.confidence >= (options.minConfidence || this.config.thresholds.minEmergingConfidence);

      if (meetsThreshold) {
        emerging.push(buildEmergingRisk({
          entity: summary.entity,
          riskScore: summary.current_risk_score,
          riskTrend: summary.risk_trend,
          signalCount: summary.number_of_risk_events,
          independentSources: summary.number_of_independent_sources,
          dominantFactors: summary.dominant_risk_factors,
          confidence: summary.confidence,
          window: windowKey,
        }));
      }
    });

    return emerging.sort((a, b) => b.risk_score - a.risk_score);
  }

  getRiskActivitySpikes(options = {}) {
    const signals = this.getAllSignals();
    if (!signals.length) {
      return [];
    }

    const windowKey = this.normalizeWindow(options.window || '6h');
    const grouped = new Map();

    signals.forEach((signal) => {
      const key = String(signal.entity_id || signal.entity || 'Unknown entity').toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(signal);
    });

    const alerts = [];
    grouped.forEach((entitySignals, entityKey) => {
      const currentWindowSignals = this.filterSignalsByWindow(entitySignals, windowKey);
      const currentRiskScore = currentWindowSignals.length
        ? Math.max(...currentWindowSignals.map((signal) => Number(signal.risk_score || 0)))
        : 0;
      const baselineSignals = this.getPreviousWindowSignals(entitySignals, windowKey);
      const baselineCount = baselineSignals.length || 0;
      const spikeRatio = currentWindowSignals.length / Math.max(1, baselineCount);
      const threshold = Math.max(this.config.thresholds.minSpikeEvents, Math.ceil(baselineCount * 1.2));

      if ((currentWindowSignals.length >= threshold || spikeRatio >= 2.5) && currentRiskScore >= 50) {
        alerts.push({
          entity: entitySignals[0]?.entity || entityKey,
          alert_type: 'RISK_ACTIVITY_SPIKE',
          window: windowKey,
          signal_count: currentWindowSignals.length,
          baseline_count: baselineCount,
          spike_ratio: Number(spikeRatio.toFixed(2)),
          current_risk_score: Number(currentRiskScore.toFixed(1)),
        });
      }
    });

    return alerts.sort((a, b) => b.signal_count - a.signal_count);
  }

  getSectorRiskSummary(sectorName, options = {}) {
    const windowKey = this.normalizeWindow(options.window || '24h');
    const sectorKey = String(sectorName || '').toLowerCase();
    let signals = [];

    if (this.riskRepository && typeof this.riskRepository.findBySector === 'function') {
      signals = this.riskRepository.findBySector(sectorName);
    } else {
      signals = this.getAllSignals().filter((signal) => String(signal.sector || '').toLowerCase() === sectorKey);
    }

    const targetSignals = this.filterSignalsByWindow(signals, windowKey);
    if (!targetSignals.length) {
      return {
        sector: sectorName,
        sector_risk_score: 0,
        affected_companies: 0,
        dominant_risk_factors: [],
        sector_trend: 'STABLE',
        signal_count: 0,
        window: windowKey,
      };
    }

    const uniqueEntities = new Set(targetSignals.map((signal) => signal.entity_id || signal.entity).filter(Boolean));
    const avgRiskScore = targetSignals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / targetSignals.length;
    const previousSignals = this.getPreviousWindowSignals(signals, windowKey);
    const previousAverage = previousSignals.length
      ? previousSignals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / previousSignals.length
      : 0;
    const delta = avgRiskScore - previousAverage;

    return {
      sector: sectorName,
      sector_risk_score: Number(avgRiskScore.toFixed(1)),
      affected_companies: uniqueEntities.size,
      dominant_risk_factors: this.getDominantFactors(targetSignals),
      sector_trend: this.classifyTrend(delta),
      signal_count: targetSignals.length,
      window: windowKey,
    };
  }

  groupSignalsByStory(signals = []) {
    const grouped = new Map();

    signals.forEach((signal) => {
      const storyKey = String(signal.story_id || signal.storyKey || signal.entity_id || signal.entity || '__unclustered__').toLowerCase();
      if (!grouped.has(storyKey)) {
        grouped.set(storyKey, []);
      }
      grouped.get(storyKey).push(signal);
    });

    return [...grouped.entries()].map(([storyKey, group]) => ({
      story_key: storyKey,
      signal_count: group.length,
      independent_sources: new Set(group.map((signal) => signal.source).filter(Boolean)).size,
      risk_score: Math.max(...group.map((signal) => Number(signal.risk_score || 0))),
      signals: group,
    }));
  }

  reset() {
    if (this.riskRepository && typeof this.riskRepository.reset === 'function') {
      this.riskRepository.reset();
    }
  }
}

module.exports = { RiskAggregationService };
