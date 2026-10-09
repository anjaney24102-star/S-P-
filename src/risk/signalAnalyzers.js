const EVENT_CATEGORIES = new Set([
  'Geopolitical', 'Macroeconomic', 'Credit Event', 'Merger/Acquisition',
  'Product Launch', 'Regulatory', 'Legal', 'Earnings', 'Supply Chain',
  'Cybersecurity', 'Other',
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

class SentimentAnalyzer {
  analyze() {
    throw new Error('SentimentAnalyzer.analyze must be implemented.');
  }
}

class NlpAnalysisSentimentAnalyzer extends SentimentAnalyzer {
  analyze(analysis) {
    const score = clamp(analysis.sentiment_score, -1, 1);
    return {
      sentiment_score: Number(score.toFixed(4)),
      sentiment_label: score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral',
      confidence: clamp(analysis.sentiment_confidence ?? analysis.financial_relevance ?? 0.5, 0, 1),
    };
  }
}

class EventClassifier {
  classify() {
    throw new Error('EventClassifier.classify must be implemented.');
  }
}

class NlpEventClassifier extends EventClassifier {
  constructor(categoryMap = {}) {
    super();
    this.categoryMap = {
      geopolitical_event: 'Geopolitical', macroeconomic_event: 'Macroeconomic',
      bankruptcy_risk: 'Credit Event', fraud_allegation: 'Credit Event',
      default_risk: 'Credit Event', acquisition: 'Merger/Acquisition', merger: 'Merger/Acquisition',
      product_launch: 'Product Launch', regulatory_action: 'Regulatory',
      lawsuit: 'Legal', litigation: 'Legal', earnings_decline: 'Earnings', earnings_growth: 'Earnings',
      supply_chain_disruption: 'Supply Chain', cybersecurity_incident: 'Cybersecurity',
      ...categoryMap,
    };
  }

  classify(analysis, event = {}) {
    const types = analysis.event_types || [];
    const mapped = types.map((type) => this.categoryMap[type]).find(Boolean);
    const text = `${event.title || ''} ${event.content || (analysis.evidence || []).join(' ')}`;
    const lexicalRules = [
      [/\b(war|sanctions?|invasion|armed conflict|tariffs?)\b/i, 'Geopolitical'],
      [/\b(inflation|interest rates|rate cuts|central bank|recession|gross domestic product|gdp)\b/i, 'Macroeconomic'],
      [/\b(bankruptcy|insolvency|default|credit stress|fraud|accounting irregularit(?:y|ies))\b/i, 'Credit Event'],
      [/\b(acquisition|acquire[sd]?|takeover|merger)\b/i, 'Merger/Acquisition'],
      [/\b(product launch|launches? (?:a |the |its )?(?:new )?product|unveils? (?:a |the |its )?(?:new )?product)\b/i, 'Product Launch'],
      [/\b(regulatory action|regulator(?:s|y)?|antitrust|compliance review|sec investigation|ftc investigation)\b/i, 'Regulatory'],
      [/\b(lawsuit|litigation|class action|legal action)\b/i, 'Legal'],
      [/\b(supply chain|supplier disruption|shipping delay|chip shortage)\b/i, 'Supply Chain'],
      [/\b(cybersecurity|cyber attack|data breach|ransomware)\b/i, 'Cybersecurity'],
      [/\b(earnings|revenue|profit guidance|quarterly results)\b/i, 'Earnings'],
    ];
    const lexicalCategory = lexicalRules.find(([pattern]) => pattern.test(text))?.[1];
    const candidate = lexicalCategory || mapped || (EVENT_CATEGORIES.has(analysis.event_classification) ? analysis.event_classification : 'Other');
    const hasCandidate = types.length > 0 && types[0] !== 'general_financial_event';
    const confidence = clamp(
      (hasCandidate ? 0.55 : 0.35) + clamp(analysis.financial_relevance, 0, 1) * 0.25
        + Math.min((analysis.evidence || []).length, 2) * 0.05,
      0, 1,
    );
    return { event_classification: candidate, confidence: Number(confidence.toFixed(4)) };
  }
}

module.exports = { EVENT_CATEGORIES, clamp, SentimentAnalyzer, NlpAnalysisSentimentAnalyzer, EventClassifier, NlpEventClassifier };
