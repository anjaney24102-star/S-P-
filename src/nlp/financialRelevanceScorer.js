const { BaseNLPComponent } = require('./baseComponent');

class FinancialRelevanceScorer extends BaseNLPComponent {
  constructor() {
    super();
    this.financialKeywords = ['earnings', 'revenue', 'profit', 'debt', 'rates', 'inflation', 'treasury', 'yield', 'stock', 'bond', 'bank', 'fed', 'regulation', 'lawsuit', 'merger', 'supply chain', 'cybersecurity', 'acquisition'];
  }

  process(input) {
    const text = input.normalizedText || '';
    const matches = this.financialKeywords.filter((keyword) => text.includes(keyword));
    const score = Math.min(1, 0.3 + matches.length * 0.12);
    return Number(score.toFixed(2));
  }
}

module.exports = { FinancialRelevanceScorer };
