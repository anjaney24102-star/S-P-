const { logger } = require('../utils/logger');
const { RiskScorer } = require('../risk/riskScorer');
const { buildRiskSignal } = require('../domain/RiskSignal');

class RiskService {
  constructor({ eventRepository, analysisRepository, riskRepository, riskScorer, alertService, credibilityService, storyClusteringService, entityResolutionService, earlyWarningService } = {}) {
    this.eventRepository = eventRepository;
    this.analysisRepository = analysisRepository;
    this.riskRepository = riskRepository;
    this.riskScorer = riskScorer || new RiskScorer();
    this.alertService = alertService;
    this.credibilityService = credibilityService;
    this.storyClusteringService = storyClusteringService;
    this.entityResolutionService = entityResolutionService;
    this.earlyWarningService = earlyWarningService;
  }

  analyzeRiskForEvent(eventId) {
    if (!this.eventRepository || !this.analysisRepository || !this.riskRepository) {
      throw new Error('Risk scoring dependencies are not configured.');
    }

    const event = this.eventRepository.findById(eventId);
    if (!event) {
      const error = new Error(`Event not found: ${eventId}`);
      error.statusCode = 404;
      error.code = 'EVENT_NOT_FOUND';
      throw error;
    }

    const analysis = this.analysisRepository.findByEventId(eventId);
    if (!analysis) {
      const error = new Error(`Analysis not found for event: ${eventId}`);
      error.statusCode = 404;
      error.code = 'ANALYSIS_NOT_FOUND';
      throw error;
    }

    const duplicates = this.riskRepository.findByEventId(eventId);
    if (duplicates && duplicates.length) {
      return {
        signal: duplicates[0],
        created: false,
        reused: true,
      };
    }

    if (this.storyClusteringService && typeof this.storyClusteringService.clusterEvent === 'function') {
      this.storyClusteringService.clusterEvent(eventId);
    }
    const clusteredEvent = this.eventRepository.findById(eventId) || event;

    const resolvedEntity = (analysis.resolved_entities || []).find((entity) => Number(entity.confidence) >= 0.82);
    const targetEntity = resolvedEntity ? resolvedEntity.canonical_name : (event.entity || event.title || 'Unknown entity');
    const sourceProfile = this.credibilityService
      ? this.credibilityService.getOrCreateProfile(event.source)
      : {
          source_name: event.source,
          source_type: 'unknown',
          credibility_score: 0.5,
          verification_status: 'unverified',
        };

    const signal = this.riskScorer.computeRisk({
      analysis,
      source: event.source,
      sourceProfile,
      publishedAt: event.published_at,
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: targetEntity,
    });

    const riskSignal = buildRiskSignal({
      entity: targetEntity,
      entityId: resolvedEntity?.entity_id || null,
      storyId: clusteredEvent.story_id || null,
      eventId: event.id,
      riskScore: signal.risk_score,
      riskLevel: signal.risk_level,
      confidence: signal.confidence,
      riskFactors: signal.risk_factors,
      explanation: signal.explanation,
      source: event.source,
      eventType: event.event_type,
      sector: event.metadata && (event.metadata.sector || event.metadata.industry || event.metadata.company_sector),
      createdAt: event.published_at || new Date().toISOString(),
    });

    const saved = this.riskRepository.save(riskSignal);
    if (this.alertService && typeof this.alertService.generateAlertsForSignal === 'function') {
      this.alertService.generateAlertsForSignal(saved);
    }
    if (resolvedEntity?.entity_id && this.earlyWarningService?.detectEntity) {
      this.earlyWarningService.detectEntity(resolvedEntity.entity_id, { window: '6h' });
    }

    logger.info('Risk signal created', {
      eventId,
      riskScore: saved.risk_score,
      riskLevel: saved.risk_level,
    });

    return {
      signal: saved,
      created: true,
      reused: false,
    };
  }

  getRiskForEntity(entityName) {
    if (this.entityResolutionService && this.riskRepository.findByEntityId) {
      const match = this.entityResolutionService.resolve(entityName);
      if (match.resolved_entity) return this.riskRepository.findByEntityId(match.resolved_entity.id);
    }
    return this.riskRepository.findByEntity(entityName);
  }

  getRecentSignals(limit = 20) {
    return this.riskRepository.findRecent(limit);
  }

  reset() {
    if (this.riskRepository) {
      this.riskRepository.reset();
    }
  }
}

module.exports = { RiskService };
