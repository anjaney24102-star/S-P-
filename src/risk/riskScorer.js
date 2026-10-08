const { risk: riskConfig } = require('../config/riskConfig');
const { buildRiskExplanation } = require('../domain/RiskExplanation');

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

  resolveSourceCredibility(source, sourceProfile) {
    if (sourceProfile && typeof sourceProfile.credibility_score === 'number') {
      return Number(sourceProfile.credibility_score);
    }

    const key = String(source || sourceProfile?.source_name || '').trim().toLowerCase();
    return Number(this.config.sourceReliability[key] ?? this.config.sourceReliability.default ?? 0.5);
  }

  computeRisk({
    analysis,
    source,
    sourceProfile,
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
    const sourceCredibility = this.resolveSourceCredibility(source, sourceProfile);
    const resolvedSourceProfile = sourceProfile || {
      source_name: String(source || 'unknown').trim().toLowerCase(),
      source_type: 'unknown',
      credibility_score: sourceCredibility,
      verification_status: 'unverified',
    };
    const hoursOld = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 3600000 : 12;
    const recency = this.recencyDecay(hoursOld);
    const evidenceConfidence = this.evidenceStrength(analysis.evidence || []);
    const duplicateBoost = repeatedSignalCount > 0 ? 0.08 * Math.min(repeatedSignalCount, 3) : 0;
    const independentBoost = independentSignalCount > 0 ? 0.12 * Math.min(independentSignalCount, 3) : 0;

    const sentimentRisk = sentimentImpact * 100 * weights.sentiment;
    const severityRisk = eventSeverity * 100 * weights.event_severity;
    const relevanceRisk = relevance * 100 * weights.financial_relevance;
    const sourceRisk = (1 - sourceCredibility) * 100 * weights.source_reliability;
    const recencyRisk = recency * 100 * weights.recency;
    const evidenceRisk = evidenceConfidence * 100 * weights.evidence_confidence;
    const repeatedRisk = (duplicateBoost + independentBoost) * 100 * weights.repeated_signals;

    const riskScore = this.normalizeScore(
      sentimentRisk + severityRisk + relevanceRisk + sourceRisk + recencyRisk + evidenceRisk + repeatedRisk,
    );

    const confidence = this.clamp(
      0.2 + (relevance * 0.25) + (eventSeverity * 0.2) + (sourceCredibility * 0.25) + (evidenceConfidence * 0.1) + (independentBoost * 0.2) - (duplicateBoost * 0.1),
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
        severity: sourceCredibility < 0.6 ? 'MEDIUM' : 'LOW',
      },
      {
        factor: 'recency',
        contribution: Number((recencyRisk).toFixed(1)),
        severity: recency < 0.6 ? 'MEDIUM' : 'LOW',
      },
    ];

    const explanation = buildRiskExplanation({
      contributingFactors: riskFactors.map((factor) => factor.factor),
      factorWeights: weights,
      factorScores: {
        sentiment: Number(sentimentRisk.toFixed(2)),
        event_severity: Number(severityRisk.toFixed(2)),
        financial_relevance: Number(relevanceRisk.toFixed(2)),
        source_reliability: Number(sourceRisk.toFixed(2)),
        source_credibility: Number(sourceRisk.toFixed(2)),
        recency: Number(recencyRisk.toFixed(2)),
        evidence_confidence: Number(evidenceRisk.toFixed(2)),
        repeated_signals: Number(repeatedRisk.toFixed(2)),
      },
      evidence: analysis.evidence || [],
      finalCalculation: `${sentimentRisk.toFixed(2)} + ${severityRisk.toFixed(2)} + ${relevanceRisk.toFixed(2)} + ${sourceRisk.toFixed(2)} + ${recencyRisk.toFixed(2)} + ${evidenceRisk.toFixed(2)} + ${repeatedRisk.toFixed(2)} = ${riskScore.toFixed(2)}`,
      modelName: 'baseline-risk-scoring',
      modelVersion: '1.0.0',
      sourceCredibility: {
        source_name: resolvedSourceProfile.source_name || String(source || 'unknown').trim().toLowerCase(),
        source_type: resolvedSourceProfile.source_type || 'unknown',
        credibility_score: Number(sourceCredibility.toFixed(4)),
        verification_status: resolvedSourceProfile.verification_status || 'unverified',
        contribution: Number(sourceRisk.toFixed(2)),
      },
    });

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
