const { logger } = require('../utils/logger');
const { FinancialNLPipeline } = require('../nlp/nlpPipeline');

class AnalysisProcessingError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AnalysisProcessingError';
    this.code = 'ANALYSIS_PROCESSING_ERROR';
    this.statusCode = 500;
    this.details = details;
  }
}

class AnalysisService {
  constructor({ eventRepository, analysisRepository, nlpPipeline, storyClusteringService } = {}) {
    this.eventRepository = eventRepository;
    this.analysisRepository = analysisRepository;
    this.nlpPipeline = nlpPipeline || new FinancialNLPipeline();
    this.storyClusteringService = storyClusteringService;
  }

  analyzeEvent(eventId, options = {}) {
    const { force = false } = options;

    if (!this.eventRepository) {
      throw new AnalysisProcessingError('Event repository is not configured.');
    }

    const event = this.eventRepository.findById(eventId);
    if (!event) {
      const error = new Error(`Event not found: ${eventId}`);
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    const existing = this.analysisRepository.findByEventId(eventId);
    if (existing && !force && existing.status === 'processed') {
      return {
        analysis: existing,
        created: false,
        reused: true,
      };
    }

    try {
      const analysis = this.nlpPipeline.process(event);
      analysis.status = 'processed';
      const saved = this.analysisRepository.save(analysis);

      logger.info('NLP analysis completed', {
        eventId,
        model: analysis.model_name,
        sentiment: analysis.sentiment_label,
      });

      if (this.storyClusteringService && typeof this.storyClusteringService.clusterEvent === 'function') {
        this.storyClusteringService.clusterEvent(eventId);
      }

      return {
        analysis: saved,
        created: true,
        reused: false,
      };
    } catch (error) {
      logger.error('NLP processing failed', {
        eventId,
        error: error.message,
      });

      const failed = {
        id: `failed-${Date.now()}`,
        event_id: eventId,
        entities: [],
        topics: [],
        sentiment_score: 0,
        sentiment_label: 'neutral',
        financial_relevance: 0,
        event_types: ['analysis_failed'],
        evidence: [],
        model_name: this.nlpPipeline.modelName || 'baseline-rule-based',
        model_version: this.nlpPipeline.modelVersion || '1.0.0',
        processed_at: new Date().toISOString(),
        status: 'failed',
      };

      this.analysisRepository.save(failed);
      throw new AnalysisProcessingError('NLP analysis failed for event.', { eventId, error: error.message });
    }
  }

  getAnalysisForEvent(eventId) {
    const analysis = this.analysisRepository.findByEventId(eventId);
    if (!analysis) {
      const error = new Error(`Analysis not found for event: ${eventId}`);
      error.statusCode = 404;
      error.code = 'ANALYSIS_NOT_FOUND';
      throw error;
    }

    return analysis;
  }

  getRecentAnalyses(limit = 20) {
    return this.analysisRepository.findRecent(limit);
  }

  reset() {
    this.analysisRepository.reset();
  }
}

module.exports = {
  AnalysisService,
  AnalysisProcessingError,
};
