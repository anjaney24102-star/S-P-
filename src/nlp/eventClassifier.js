const { BaseNLPComponent } = require('./baseComponent');

class FinancialEventClassifier extends BaseNLPComponent {
  constructor() {
    super();
    this.rules = [
      { type: 'earnings_decline', keywords: ['earnings miss', 'earnings decline', 'revenue miss', 'weak earnings'] },
      { type: 'earnings_growth', keywords: ['earnings beat', 'profit growth', 'strong earnings', 'revenue growth'] },
      { type: 'executive_change', keywords: ['ceo resigns', 'executive change', 'leadership transition', 'board change'] },
      { type: 'lawsuit', keywords: ['lawsuit', 'litigation', 'class action', 'legal action'] },
      { type: 'regulatory_action', keywords: ['regulation', 'regulatory', 'sec action', 'ftc review', 'ban', 'antitrust', 'review', 'scrutiny', 'oversight', 'federal reserve'] },
      { type: 'fraud_allegation', keywords: ['fraud', 'scandal', 'misconduct', 'accounting fraud'] },
      { type: 'bankruptcy_risk', keywords: ['bankruptcy', 'insolvency', 'credit stress', 'default risk'] },
      { type: 'acquisition', keywords: ['acquisition', 'takeover', 'acquire', 'merger'] },
      { type: 'cybersecurity_incident', keywords: ['cybersecurity', 'cyber attack', 'data breach', 'security incident'] },
      { type: 'supply_chain_disruption', keywords: ['supply chain', 'chip shortage', 'shipping delay', 'lead time'] },
    ];
  }

  process(input) {
    const text = input.normalizedText || '';
    const matched = this.rules
      .filter(({ keywords }) => keywords.some((keyword) => text.includes(keyword.toLowerCase())))
      .map(({ type }) => type);

    return matched.length ? matched : ['general_financial_event'];
  }
}

module.exports = { FinancialEventClassifier };
