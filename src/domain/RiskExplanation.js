const buildRiskExplanation = ({
  contributingFactors = [],
  factorWeights = {},
  factorScores = {},
  evidence = [],
  finalCalculation = '',
  modelName = 'baseline-risk-scoring',
  modelVersion = '1.0.0',
  sourceCredibility = {},
}) => ({
  contributing_factors: contributingFactors,
  factor_weights: factorWeights,
  factor_scores: factorScores,
  evidence,
  final_calculation: finalCalculation,
  model_name: modelName,
  model_version: modelVersion,
  source_credibility: {
    source_name: sourceCredibility.source_name || 'unknown',
    source_type: sourceCredibility.source_type || 'unknown',
    credibility_score: Number(sourceCredibility.credibility_score ?? 0),
    verification_status: sourceCredibility.verification_status || 'unknown',
    contribution: Number(sourceCredibility.contribution ?? 0),
  },
});

module.exports = { buildRiskExplanation };
