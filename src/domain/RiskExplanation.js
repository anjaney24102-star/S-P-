const buildRiskExplanation = ({
  contributingFactors = [],
  factorWeights = {},
  factorScores = {},
  evidence = [],
  finalCalculation = '',
  modelName = 'baseline-risk-scoring',
  modelVersion = '1.0.0',
}) => ({
  contributing_factors: contributingFactors,
  factor_weights: factorWeights,
  factor_scores: factorScores,
  evidence,
  final_calculation: finalCalculation,
  model_name: modelName,
  model_version: modelVersion,
});

module.exports = { buildRiskExplanation };
