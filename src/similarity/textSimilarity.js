class TextSimilarityEngine {
  normalizeText(text = '') {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenize(text = '') {
    const normalized = this.normalizeText(text);
    return normalized ? normalized.split(' ').filter(Boolean) : [];
  }

  buildFrequencyMap(text = '') {
    const map = new Map();
    this.tokenize(text).forEach((term) => {
      map.set(term, (map.get(term) || 0) + 1);
    });
    return map;
  }

  cosineSimilarity(leftText = '', rightText = '') {
    const leftMap = this.buildFrequencyMap(leftText);
    const rightMap = this.buildFrequencyMap(rightText);
    const terms = new Set([...leftMap.keys(), ...rightMap.keys()]);

    if (!terms.size) {
      return 0;
    }

    let dotProduct = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    terms.forEach((term) => {
      const leftCount = leftMap.get(term) || 0;
      const rightCount = rightMap.get(term) || 0;
      dotProduct += leftCount * rightCount;
      leftMagnitude += leftCount * leftCount;
      rightMagnitude += rightCount * rightCount;
    });

    if (!leftMagnitude || !rightMagnitude) {
      return 0;
    }

    return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  jaccardSimilarity(leftText = '', rightText = '') {
    const leftTokens = new Set(this.tokenize(leftText));
    const rightTokens = new Set(this.tokenize(rightText));

    if (!leftTokens.size && !rightTokens.size) {
      return 0;
    }

    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union ? intersection / union : 0;
  }

  score(leftText = '', rightText = '') {
    const cosine = this.cosineSimilarity(leftText, rightText);
    const jaccard = this.jaccardSimilarity(leftText, rightText);

    return Number(Math.max(cosine, jaccard).toFixed(4));
  }
}

module.exports = {
  TextSimilarityEngine,
};
