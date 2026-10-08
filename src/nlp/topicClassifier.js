const { BaseNLPComponent } = require('./baseComponent');

class TopicClassifier extends BaseNLPComponent {
  constructor() {
    super();
    this.topicMap = [
      { topic: 'earnings', keywords: ['earnings', 'revenue', 'profit', 'guidance', 'quarterly results'] },
      { topic: 'debt', keywords: ['debt', 'leverage', 'credit', 'bond', 'liquidity'] },
      { topic: 'layoffs', keywords: ['layoffs', 'job cuts', 'redundancies', 'restructuring'] },
      { topic: 'acquisition', keywords: ['acquisition', 'acquire', 'takeover', 'merger', 'deal'] },
      { topic: 'fraud', keywords: ['fraud', 'scandal', 'misconduct', 'accounting issue'] },
      { topic: 'regulation', keywords: ['regulation', 'regulatory', 'compliance', 'rule', 'ban', 'oversight'] },
      { topic: 'lawsuit', keywords: ['lawsuit', 'litigation', 'legal action', 'class action', 'settlement'] },
      { topic: 'cybersecurity', keywords: ['cybersecurity', 'cyber', 'data breach', 'security incident'] },
      { topic: 'product launch', keywords: ['product launch', 'launch', 'release', 'new product', 'rollout'] },
      { topic: 'supply chain', keywords: ['supply chain', 'shipping', 'supplier', 'lead time', 'chip shortage'] },
      { topic: 'macro', keywords: ['inflation', 'rates', 'yield', 'treasury', 'fed', 'macro'] },
    ];
  }

  process(input) {
    const text = input.normalizedText || '';
    const matches = [];

    this.topicMap.forEach(({ topic, keywords }) => {
      const hasMatch = keywords.some((keyword) => text.includes(keyword.toLowerCase()));
      if (hasMatch) {
        matches.push({
          topic,
          confidence: 0.8,
        });
      }
    });

    return matches;
  }
}

module.exports = { TopicClassifier };
