const { risk: riskConfig } = require('../config/riskConfig');

class RiskScorer {
  constructor(config = riskConfig) {
    this.config = config;
  }

  clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
  }

  normalizeScore(value) {
    return this.clamp(value, this.config.minScore, this.config.maxScore);
  }

  determineRiskLevel(score) {
    if (score >= 85) return 'CRITICAL';
    if (score >= 65) return 'HIGH';
    if (score >= 35) return 'MEDIUM';
    return 'LOW';
  }

  sentimentScoreToImpact(sentimentScore) {
    if (sentimentScore >= 0.2) return 0.15;
    if (sentimentScore <= -0.2) return 0.85;
    return 0.45;
  }

  getEventSeverity(eventTypes = []) {
    const typeScores = eventTypes.map((type) => this.config.eventSeverityMap[type] || this.config.eventSeverityMap.general_financial_event);
    return typeScores.length ? Math.max(...typeScores) : this.config.eventSeverityMap.general_financial_event;
  }

  recencyDecay(hoursOld) {
    const hours = Math.max(0, hoursOld);
    const decay = Math.pow(this.config.recencyDecayBase, hours / 12);
    return this.clamp(decay, 0.2, 1);
  }

  evidenceStrength(evidence = []) {
    if (!evidence || !evidence.length) return 0.4;
    return Math.min(1, 0.5 + evidence.length * 0.1);
  }

  computeRisk({
    analysis,
    source,
    publishedAt,
    repeatedSignalCount = 0,
    independentSignalCount = 0,
    entityName = 'Unknown entity',
  }) {
    const weights = this.config.weights;
    const sentimentScore = Number(analysis.sentiment_score || 0);
    const sentimentImpact = this.sentimentScoreToImpact(sentimentScore);
    const eventSeverity = this.getEventSeverity(analysis.event_types || []);
    const relevance = Number(analysis.financial_relevance || 0);
    const sourceReliability = this.config.sourceReliability[source] || this.config.sourceReliability.default;
    const hoursOld = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 3600000 : 12;
    const recency = this.recencyDecay(hoursOld);
    const evidenceConfidence = this.evidenceStrength(analysis.evidence || []);
    const duplicateBoost = repeatedSignalCount > 0 ? 0.15 * Math.min(repeatedSignalCount, 3) : 0;
    const independentBoost = independentSignalCount > 0 ? 0.12 * Math.min(independentSignalCount, 3) : 0;

    const sentimentRisk = sentimentImpact * 100 * weights.sentiment;
    const severityRisk = eventSeverity * 100 * weights.event_severity;
    const relevanceRisk = relevance * 100 * weights.financial_relevance;
    const sourceRisk = (1 - sourceReliability) * 100 * weights.source_reliability;
    const recencyRisk = recency * 100 * weights.recency;
    const evidenceRisk = evidenceConfidence * 100 * weights.evidence_confidence;
    const repeatedRisk = (duplicateBoost + independentBoost) * 100 * weights.repeated_signals;

    const riskScore = this.normalizeScore(
      sentimentRisk + severityRisk + relevanceRisk + sourceRisk + recencyRisk + evidenceRisk + repeatedRisk,
    );

    const confidence = this.clamp(
      0.4 + (relevance * 0.3) + (eventSeverity * 0.25) + (sourceReliability * 0.15) + (evidenceConfidence * 0.1),
      0,
      1,
    );

    const riskFactors = [
      {
        factor: sentimentScore < 0 ? 'negative_sentiment' : 'positive_sentiment',
        contribution: Number((sentimentRisk * 0.8).toFixed(1)),
        severity: sentimentScore < 0 ? 'HIGH' : 'LOW',
      },
      {
        factor: analysis.event_types && analysis.event_types[0] ? analysis.event_types[0] : 'general_financial_event',
        contribution: Number((severityRisk * 0.9).toFixed(1)),
        severity: this.determineRiskLevel(severityRisk),
      },
      {
        factor: 'financial_relevance',
        contribution: Number((relevanceRisk).toFixed(1)),
        severity: relevance >= 0.7 ? 'HIGH' : relevance >= 0.4 ? 'MEDIUM' : 'LOW',
      },
      {
        factor: 'source_reliability',
        contribution: Number((sourceRisk).toFixed(1)),
        severity: sourceReliability < 0.6 ? 'MEDIUM' : 'LOW',
      },
      {
        factor: 'recency',
        contribution: Number((recencyRisk).toFixed(1)),
        severity: recency < 0.6 ? 'MEDIUM' : 'LOW',
      },
    ];

    const explanation = {
      contributing_factors: riskFactors.map((factor) => factor.factor),
      factor_weights: weights,
      factor_scores: {
        sentiment: Number(sentimentRisk.toFixed(2)),
        event_severity: Number(severityRisk.toFixed(2)),
        financial_relevance: Number(relevanceRisk.toFixed(2)),
        source_reliability: Number(sourceRisk.toFixed(2)),
        recency: Number(recencyRisk.toFixed(2)),
        evidence_confidence: Number(evidenceRisk.toFixed(2)),
        repeated_signals: Number(repeatedRisk.toFixed(2)),
      },
      evidence: analysis.evidence || [],
      final_calculation: `${sentimentRisk.toFixed(2)} + ${severityRisk.toFixed(2)} + ${relevanceRisk.toFixed(2)} + ${sourceRisk.toFixed(2)} + ${recencyRisk.toFixed(2)} + ${evidenceRisk.toFixed(2)} + ${repeatedRisk.toFixed(2)} = ${riskScore.toFixed(2)}`,
      model_name: 'baseline-risk-scoring',
      model_version: '1.0.0',
    };

    return {
      entity: entityName,
      risk_score: Number(riskScore.toFixed(1)),
      risk_level: this.determineRiskLevel(riskScore),
      confidence: Number(confidence.toFixed(2)),
      risk_factors: riskFactors,
      explanation,
    };
  }
}

module.exports = { RiskScorer };
