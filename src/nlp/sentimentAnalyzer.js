const { BaseNLPComponent } = require('./baseComponent');

class SentimentAnalyzer extends BaseNLPComponent {
  constructor() {
    super();
    this.positiveWords = ['gain', 'growth', 'beat', 'upgrade', 'rebound', 'strong', 'profit', 'rally', 'boost', 'increase', 'recover', 'surge'];
    this.negativeWords = ['loss', 'decline', 'fell', 'downgrade', 'risk', 'delay', 'shortage', 'lawsuit', 'fraud', 'drop', 'cut', 'fall', 'concern', 'warning', 'bankruptcy', 'recall'];
  }

  process(input) {
    const text = input.normalizedText || '';
    let score = 0;

    this.positiveWords.forEach((word) => {
      if (text.includes(word)) {
        score += 0.1;
      }
    });

    this.negativeWords.forEach((word) => {
      if (text.includes(word)) {
        score -= 0.12;
      }
    });

    if (score > 0.2) {
      return { score: Math.min(score, 1), label: 'positive' };
    }

    if (score < -0.2) {
      return { score: Math.max(score, -1), label: 'negative' };
    }

    return { score: 0, label: 'neutral' };
  }
}

module.exports = { SentimentAnalyzer };
