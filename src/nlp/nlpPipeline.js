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
    this.modelName = modelName;
    this.modelVersion = modelVersion;
  }

  process(event) {
    const preprocessed = this.preprocessor.process(event);
    const entities = this.entityExtractor.process(preprocessed);
    const topics = this.topicClassifier.process(preprocessed);
    const sentiment = this.sentimentAnalyzer.process(preprocessed);
    const eventTypes = this.eventClassifier.process(preprocessed);
    const relevance = this.relevanceScorer.process(preprocessed);
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
      topics: topics.map((item) => ({ ...item })),
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      financialRelevance: relevance,
      eventTypes,
      evidence: evidence.length ? evidence : [preprocessed.combinedText.slice(0, 200)],
      modelName: this.modelName,
      modelVersion: this.modelVersion,
    });
  }
}

module.exports = { FinancialNLPipeline };
