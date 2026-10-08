const buildEmergingRisk = ({
  entity,
  riskScore,
  riskTrend,
  signalCount,
  independentSources,
  dominantFactors,
  confidence,
  window,
}) => ({
  entity,
  risk_score: Number(riskScore),
  risk_trend: riskTrend,
  signal_count: Number(signalCount),
  independent_sources: Number(independentSources),
  dominant_factors: dominantFactors || [],
  confidence: Number(confidence),
  window,
});

module.exports = { buildEmergingRisk };
