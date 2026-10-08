const { BaseNLPComponent } = require('./baseComponent');

class EntityExtractor extends BaseNLPComponent {
  constructor() {
    super();
    this.entityPatterns = [
      { type: 'company', values: ['microsoft', 'apple', 'nvidia', 'tesla', 'amazon', 'meta', 'google', 'jpmorgan', 'goldman sachs', 'bank of america', 'delta', 'cisco', 'oracle', 'intel', 'salesforce', 'uber', 'airbnb', 'walmart'] },
      { type: 'organization', values: ['fed', 'federal reserve', 'sec', 'ftc', 'treasury', 'ecb', 'opec', 'eu', 'united nations'] },
      { type: 'person', values: ['powell', 'janet yellen', 'elon musk', 'tim cook', 'sundar pichai', 'jamie dimon'] },
      { type: 'country', values: ['us', 'usa', 'united states', 'china', 'europe', 'eurozone', 'uk', 'britain', 'japan', 'canada'] },
      { type: 'financial_instrument', values: ['treasury', 'bond', 'bonds', 'equity', 'equities', 'dollar', 'usd', 'eur', 'oil', 'gold', 'credit default swap', 'etf', 'stock', 'stocks'] },
      { type: 'sector', values: ['technology', 'banking', 'finance', 'energy', 'semiconductor', 'retail', 'healthcare', 'industrial', 'automotive', 'telecom'] },
    ];
  }

  process(input) {
    const text = input.normalizedText || '';
    const results = [];
    const seen = new Set();

    this.entityPatterns.forEach(({ type, values }) => {
      values.forEach((value) => {
        if (text.includes(value.toLowerCase())) {
          const key = `${type}:${value}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              type,
              value,
              confidence: 0.78,
            });
          }
        }
      });
    });

    return results;
  }
}

module.exports = { EntityExtractor };
