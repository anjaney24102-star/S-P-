const { BaseNLPComponent } = require('./baseComponent');
const { TextPreprocessor } = require('./textPreprocessor');
const { EntityExtractor } = require('./entityExtractor');
const { TopicClassifier } = require('./topicClassifier');
const { SentimentAnalyzer } = require('./sentimentAnalyzer');
const { FinancialEventClassifier } = require('./eventClassifier');
const { FinancialRelevanceScorer } = require('./financialRelevanceScorer');
const { buildNLPAnalysis } = require('../domain/NLPAnalysis');

class FinancialNLPipeline extends BaseNLPComponent {
  constructor({
    preprocessor = new TextPreprocessor(),
    entityExtractor = new EntityExtractor(),
    topicClassifier = new TopicClassifier(),
    sentimentAnalyzer = new SentimentAnalyzer(),
    eventClassifier = new FinancialEventClassifier(),
    relevanceScorer = new FinancialRelevanceScorer(),
    entityResolutionService = null,
    modelName = 'baseline-rule-based',
    modelVersion = '1.0.0',
  } = {}) {
    super();
    this.preprocessor = preprocessor;
    this.entityExtractor = entityExtractor;
    this.topicClassifier = topicClassifier;
    this.sentimentAnalyzer = sentimentAnalyzer;
    this.eventClassifier = eventClassifier;
    this.relevanceScorer = relevanceScorer;
    this.entityResolutionService = entityResolutionService;
    this.modelName = modelName;
    this.modelVersion = modelVersion;
  }

  process(event) {
    const preprocessed = this.preprocessor.process(event);
    const entities = this.entityExtractor.process(preprocessed);
    const resolvedEntities = this.entityResolutionService
      ? this.entityResolutionService.resolveEvent(event, entities)
      : [];
    const topics = this.topicClassifier.process(preprocessed);
    const sentiment = this.sentimentAnalyzer.process(preprocessed);
    const eventTypes = this.eventClassifier.process(preprocessed);
    const relevance = this.relevanceScorer.process(preprocessed);
    const eventClassification = this.classifyEvent(eventTypes);
    const severity = Math.max(...eventTypes.map((type) => ({
      regulatory_action: 9, lawsuit: 9, fraud_allegation: 10, bankruptcy_risk: 10,
      earnings_decline: 8, earnings_growth: 5, executive_change: 6, acquisition: 7,
      cybersecurity_incident: 8, supply_chain_disruption: 7, general_financial_event: 5,
    }[type] || 5)));
    const impactScore = Math.min(10, Math.max(1, Math.round(severity * 0.65 + Math.abs(sentiment.score) * 2 + relevance * 1.5)));
    const evidence = preprocessed.sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      return lower.includes('earnings')
        || lower.includes('rates')
        || lower.includes('lawsuit')
        || lower.includes('supply')
        || lower.includes('cyber')
        || lower.includes('revenue')
        || lower.includes('debt')
        || lower.includes('acquisition')
        || lower.includes('inflation')
        || lower.includes('merger');
    });

    return buildNLPAnalysis({
      eventId: event.id,
      entities,
      resolved_entities: resolvedEntities,
      topics: topics.map((item) => ({ ...item })),
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      financialRelevance: relevance,
      eventTypes,
      eventClassification,
      impactScore,
      evidence: evidence.length ? evidence : [preprocessed.combinedText.slice(0, 200)],
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    });
  }

  classifyEvent(eventTypes = []) {
    const categories = {
      geopolitical_event: 'Geopolitical', macroeconomic_event: 'Macroeconomic', product_launch: 'Product Launch',
      regulatory_action: 'Regulatory', lawsuit: 'Credit Event', fraud_allegation: 'Credit Event',
      bankruptcy_risk: 'Credit Event', earnings_decline: 'Corporate Performance',
      earnings_growth: 'Corporate Performance', executive_change: 'Corporate',
      acquisition: 'Merger/Acquisition', cybersecurity_incident: 'Operational',
      supply_chain_disruption: 'Geopolitical', general_financial_event: 'Other',
    };
    return categories[eventTypes[0]] || 'Other';
  }
}

module.exports = { FinancialNLPipeline };
