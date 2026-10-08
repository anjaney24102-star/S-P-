class ZScoreAlgorithm {
  constructor({ zeroVarianceScore = 5 } = {}) { this.zeroVarianceScore = zeroVarianceScore; this.name = 'z_score'; }
  score(current, samples = []) {
    if (!samples.length) return 0;
    const mean = samples.reduce((sum, value) => sum + Number(value || 0), 0) / samples.length;
    const variance = samples.reduce((sum, value) => sum + ((Number(value || 0) - mean) ** 2), 0) / samples.length;
    const deviation = Math.sqrt(variance);
    if (deviation === 0) return current > mean ? (current - mean) / Math.sqrt(Math.max(mean, 1)) : 0;
    return (current - mean) / deviation;
  }
}

class EWMAMeanShiftAlgorithm {
  constructor({ alpha = 0.3, zeroVarianceScore = 5 } = {}) { this.alpha = alpha; this.zeroVarianceScore = zeroVarianceScore; this.name = 'ewma'; }
  score(current, samples = []) {
    if (!samples.length) return 0;
    const chronological = [...samples].map((value) => Number(value || 0));
    let mean = chronological[0];
    let variance = 0;
    chronological.slice(1).forEach((value) => {
      const difference = value - mean;
      mean += this.alpha * difference;
      variance = ((1 - this.alpha) * (variance + (this.alpha * difference * difference)));
    });
    const deviation = Math.sqrt(variance);
    if (deviation === 0) return current > mean ? (current - mean) / Math.sqrt(Math.max(mean, 1)) : 0;
    return (current - mean) / deviation;
  }
}

module.exports = { ZScoreAlgorithm, EWMAMeanShiftAlgorithm };
