class DashboardService {
  constructor({ riskRepository, riskAggregationService, alertService } = {}) {
    this.riskRepository = riskRepository;
    this.riskAggregationService = riskAggregationService;
    this.alertService = alertService;
  }

  normalizeWindow(windowKey = '24h') {
    const normalized = String(windowKey || '24h').toLowerCase();
    return ['1h', '6h', '24h', '7d', '30d'].includes(normalized) ? normalized : '24h';
  }

  getSignals(filters = {}) {
    if (!this.riskRepository || typeof this.riskRepository.findAll !== 'function') {
      return [];
    }

    let signals = this.riskRepository.findAll();
    const {
      entity,
      sector,
      riskLevel,
      eventType,
      source,
      start,
      end,
      window = '24h',
    } = filters;

    const windowMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[this.normalizeWindow(window)] || 24 * 60 * 60 * 1000;

    if (entity) {
      signals = signals.filter((signal) => String(signal.entity || '').toLowerCase() === String(entity).toLowerCase());
    }

    if (sector) {
      signals = signals.filter((signal) => String(signal.sector || '').toLowerCase() === String(sector).toLowerCase());
    }

    if (riskLevel) {
      signals = signals.filter((signal) => String(signal.risk_level || '').toLowerCase() === String(riskLevel).toLowerCase());
    }

    if (eventType) {
      signals = signals.filter((signal) => String(signal.event_type || '').toLowerCase() === String(eventType).toLowerCase());
    }

    if (source) {
      signals = signals.filter((signal) => String(signal.source || '').toLowerCase() === String(source).toLowerCase());
    }

    if (start) {
      const startTime = new Date(start).getTime();
      if (!Number.isNaN(startTime)) {
        signals = signals.filter((signal) => new Date(signal.created_at || Date.now()).getTime() >= startTime);
      }
    }

    if (end) {
      const endTime = new Date(end).getTime();
      if (!Number.isNaN(endTime)) {
        signals = signals.filter((signal) => new Date(signal.created_at || Date.now()).getTime() <= endTime);
      }
    }

    const now = Date.now();
    signals = signals.filter((signal) => {
      const timestamp = new Date(signal.created_at || Date.now()).getTime();
      return timestamp >= now - windowMs;
    });

    return [...signals].sort((a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now()));
  }

  scoreToRiskLevel(score) {
    const value = Number(score || 0);
    if (value >= 85) return 'CRITICAL';
    if (value >= 65) return 'HIGH';
    if (value >= 35) return 'MEDIUM';
    return 'LOW';
  }

  getDominantFactors(signals = []) {
    const counts = new Map();
    signals.forEach((signal) => {
      const factors = Array.isArray(signal.risk_factors) ? signal.risk_factors : [];
      factors.forEach((factor) => {
        const key = String(factor).toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor]) => factor);
  }

  buildRiskTrendChart(signals = [], windowKey = '24h') {
    const normalizedWindow = this.normalizeWindow(windowKey);
    const bucketCount = 6;
    const windowMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[normalizedWindow] || 24 * 60 * 60 * 1000;

    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = Date.now() - ((bucketCount - index) * windowMs);
      const bucketEnd = bucketStart + windowMs;
      const bucketSignals = signals.filter((signal) => {
        const ts = new Date(signal.created_at || Date.now()).getTime();
        return ts >= bucketStart && ts < bucketEnd;
      });
      const averageRisk = bucketSignals.length
        ? bucketSignals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / bucketSignals.length
        : 0;
      return {
        timestamp: new Date(bucketStart).toISOString(),
        avg_risk_score: Number(averageRisk.toFixed(1)),
        signal_count: bucketSignals.length,
      };
    });

    return buckets.filter((bucket) => bucket.signal_count > 0 || bucket.avg_risk_score > 0);
  }

  buildTopRiskyEntities(signals = [], windowKey = '24h') {
    if (!signals.length) return [];

    const grouped = new Map();
    signals.forEach((signal) => {
      const entity = String(signal.entity || 'Unknown entity');
      if (!grouped.has(entity)) grouped.set(entity, []);
      grouped.get(entity).push(signal);
    });

    return [...grouped.entries()]
      .map(([entity, entitySignals]) => {
        const summary = this.riskAggregationService && typeof this.riskAggregationService.getEntityRiskSummary === 'function'
          ? this.riskAggregationService.getEntityRiskSummary(entity, { window: windowKey })
          : {
              current_risk_score: entitySignals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / entitySignals.length,
              confidence: 0.5,
              risk_trend: 'STABLE',
              dominant_risk_factors: this.getDominantFactors(entitySignals),
            };
        return {
          entity,
          risk_score: Number(summary.current_risk_score || 0),
          risk_level: this.scoreToRiskLevel(summary.current_risk_score || 0),
          trend: summary.risk_trend || 'STABLE',
          confidence: Number(summary.confidence || 0),
          signal_count: entitySignals.length,
          dominant_factors: summary.dominant_risk_factors || this.getDominantFactors(entitySignals),
        };
      })
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10);
  }

  getDashboardSummary(options = {}) {
    const windowKey = this.normalizeWindow(options.window || '24h');
    const signals = this.getSignals({ ...options, window: windowKey });
    const riskDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    signals.forEach((signal) => {
      const level = String(signal.risk_level || this.scoreToRiskLevel(signal.risk_score || 0)).toUpperCase();
      riskDistribution[level] = (riskDistribution[level] || 0) + 1;
    });

    const overallRisk = signals.length
      ? signals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / signals.length
      : 0;

    const topRiskyEntities = this.buildTopRiskyEntities(signals, windowKey);
    const emergingRisks = this.riskAggregationService && typeof this.riskAggregationService.getEmergingRisks === 'function'
      ? this.riskAggregationService.getEmergingRisks({ window: windowKey })
      : [];
    const spikes = this.riskAggregationService && typeof this.riskAggregationService.getRiskActivitySpikes === 'function'
      ? this.riskAggregationService.getRiskActivitySpikes({ window: windowKey })
      : [];

    return {
      generated_at: new Date().toISOString(),
      window: windowKey,
      market_summary: {
        overall_risk_score: Number(overallRisk.toFixed(1)),
        risk_level: this.scoreToRiskLevel(overallRisk),
        total_entities: new Set(signals.map((signal) => signal.entity)).size,
        total_signals: signals.length,
        alerts_active: this.alertService && typeof this.alertService.getAlerts === 'function'
          ? this.alertService.getAlerts({ acknowledged: false }).length
          : 0,
      },
      top_risky_entities: topRiskyEntities,
      emerging_risks: emergingRisks,
      risk_activity_spikes: spikes,
      risk_trend_chart: this.buildRiskTrendChart(signals, windowKey),
      risk_distribution: riskDistribution,
      dominant_risk_factors: this.getDominantFactors(signals),
      recent_risk_events: signals.slice(0, Number(options.limit || 10)).map((signal) => ({
        id: signal.id,
        entity: signal.entity,
        risk_score: Number(signal.risk_score || 0),
        risk_level: signal.risk_level || this.scoreToRiskLevel(signal.risk_score || 0),
        event_type: signal.event_type,
        source: signal.source,
        created_at: signal.created_at,
        risk_factors: signal.risk_factors || [],
      })),
    };
  }

  getEntityDashboard(entityName, options = {}) {
    const windowKey = this.normalizeWindow(options.window || '24h');
    const signals = this.getSignals({ ...options, entity: entityName, window: windowKey });
    const summary = this.riskAggregationService && typeof this.riskAggregationService.getEntityRiskSummary === 'function'
      ? this.riskAggregationService.getEntityRiskSummary(entityName, { window: windowKey })
      : {
          current_risk_score: signals.length ? signals.reduce((total, signal) => total + Number(signal.risk_score || 0), 0) / signals.length : 0,
          previous_risk_score: 0,
          risk_delta: 0,
          confidence: 0,
          risk_trend: 'STABLE',
          dominant_risk_factors: this.getDominantFactors(signals),
        };

    const sourceBreakdown = signals.reduce((acc, signal) => {
      const source = String(signal.source || 'unknown');
      if (!acc[source]) acc[source] = { count: 0, total_risk: 0 };
      acc[source].count += 1;
      acc[source].total_risk += Number(signal.risk_score || 0);
      return acc;
    }, {});

    const sentimentTrend = signals.map((signal) => {
      const explanation = signal.explanation || {};
      const factorScores = explanation.factor_scores || {};
      return {
        timestamp: signal.created_at,
        sentiment_score: Number(factorScores.sentiment || 0),
        risk_score: Number(signal.risk_score || 0),
      };
    });

    const recentEvents = signals.slice(0, Number(options.limit || 10)).map((signal) => ({
      id: signal.id,
      event_type: signal.event_type,
      source: signal.source,
      created_at: signal.created_at,
      risk_score: Number(signal.risk_score || 0),
      risk_level: signal.risk_level || this.scoreToRiskLevel(signal.risk_score || 0),
      risk_factors: signal.risk_factors || [],
      explanation: signal.explanation || {},
    }));

    const dominantFactors = summary.dominant_risk_factors || this.getDominantFactors(signals);
    const topRiskSignal = signals[0];
    const whyRisky = topRiskSignal
      ? `${entityName} is considered risky because ${dominantFactors.join(', ') || 'recent financial event signals'} are associated with ${signals.length} risk signals, with the latest event (${topRiskSignal.event_type}) scoring ${Number(topRiskSignal.risk_score || 0)} and a ${topRiskSignal.risk_level || this.scoreToRiskLevel(topRiskSignal.risk_score || 0)} risk level.`
      : `${entityName} has no recent risk signal activity in the current window.`;

    return {
      entity: entityName,
      current_risk_score: Number(summary.current_risk_score || 0),
      previous_risk_score: Number(summary.previous_risk_score || 0),
      risk_delta: Number(summary.risk_delta || 0),
      risk_trend: summary.risk_trend || 'STABLE',
      confidence: Number(summary.confidence || 0),
      risk_history: this.riskAggregationService && typeof this.riskAggregationService.getEntityRiskHistory === 'function'
        ? this.riskAggregationService.getEntityRiskHistory(entityName, { window: windowKey })
        : this.buildRiskTrendChart(signals, windowKey),
      recent_events: recentEvents,
      dominant_risk_factors: dominantFactors,
      source_breakdown: Object.entries(sourceBreakdown).map(([source, detail]) => ({
        source,
        event_count: detail.count,
        average_risk_score: Number((detail.total_risk / Math.max(detail.count, 1)).toFixed(1)),
      })),
      sentiment_trend: sentimentTrend,
      nlp_evidence: {
        risk_factors: dominantFactors,
        top_events: recentEvents.slice(0, 3).map((event) => ({
          event_type: event.event_type,
          source: event.source,
          risk_score: event.risk_score,
          risk_factors: event.risk_factors,
        })),
      },
      explainable_scoring_breakdown: topRiskSignal && topRiskSignal.explanation ? topRiskSignal.explanation : {
        factor_scores: {},
        explanation: 'No detailed scoring explanation available for this signal.',
      },
      why_is_this_company_risky: whyRisky,
    };
  }

  getRiskHistory(entityName, options = {}) {
    const windowKey = this.normalizeWindow(options.window || '24h');
    if (!this.riskAggregationService || typeof this.riskAggregationService.getEntityRiskHistory !== 'function') {
      const signals = this.getSignals({ ...options, entity: entityName, window: windowKey });
      return this.buildRiskTrendChart(signals, windowKey);
    }

    return this.riskAggregationService.getEntityRiskHistory(entityName, { window: windowKey });
  }
}

module.exports = { DashboardService };
