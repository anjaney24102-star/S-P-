const express = require('express');
const { createIngestionRouter } = require('./routes/ingestionRoutes');
const { createAnalysisRouter } = require('./routes/analysisRoutes');
const { createRiskRouter } = require('./routes/riskRoutes');
const { createAggregationRouter } = require('./routes/aggregationRoutes');
const { createDashboardRouter } = require('./routes/dashboardRoutes');
const { createAlertRouter } = require('./routes/alertRoutes');
const { createSourceRouter } = require('./routes/sourceRoutes');
const { createStoryRouter } = require('./routes/storyRoutes');
const { createEntityRouter } = require('./routes/entityRoutes');
const { createEarlyWarningRouter } = require('./routes/earlyWarningRoutes');
const { IngestionService } = require('./services/ingestionService');
const { EventRepository } = require('./repositories/eventRepository');
const { AnalysisRepository } = require('./repositories/analysisRepository');
const { RiskRepository } = require('./repositories/riskRepository');
const { AlertRepository } = require('./repositories/alertRepository');
const { SourceProfileRepository } = require('./repositories/sourceProfileRepository');
const { StoryRepository } = require('./repositories/storyRepository');
const { EntityRepository } = require('./repositories/entityRepository');
const { EntityMentionRepository } = require('./repositories/entityMentionRepository');
const { EntityRiskBaselineRepository } = require('./repositories/entityRiskBaselineRepository');
const { EarlyWarningRepository } = require('./repositories/earlyWarningRepository');
const { SourceAdapterRegistry } = require('./adapters/sourceRegistry');
const { FinancialNLPipeline } = require('./nlp/nlpPipeline');
const { AnalysisService } = require('./services/analysisService');
const { RiskService } = require('./services/riskService');
const { StoryClusteringService } = require('./services/storyClusteringService');
const { RiskAggregationService } = require('./services/riskAggregationService');
const { AlertService } = require('./services/alertService');
const { DashboardService } = require('./services/dashboardService');
const { CredibilityService } = require('./services/credibilityService');
const { EntityResolutionService } = require('./services/entityResolutionService');
const { EarlyWarningService } = require('./services/earlyWarningService');
const defaultEntities = require('./config/defaultEntities');
const { storagePath, analysisStoragePath, riskStoragePath, alertStoragePath, alertConfigPath, sourceProfileStoragePath, storyStoragePath, entityStoragePath, entityMentionStoragePath, entityRiskBaselineStoragePath, earlyWarningStoragePath, nlpModelName, nlpModelVersion } = require('./config');
const { logger } = require('./utils/logger');

const repository = new EventRepository(storagePath);
const service = new IngestionService({
  repository,
  sourceRegistry: new SourceAdapterRegistry(),
});

const analysisRepository = new AnalysisRepository(analysisStoragePath);
const riskRepository = new RiskRepository(riskStoragePath);
const alertRepository = new AlertRepository(alertStoragePath, alertConfigPath);
const sourceProfileRepository = new SourceProfileRepository(sourceProfileStoragePath);
const storyRepository = new StoryRepository(storyStoragePath);
const entityRepository = new EntityRepository(entityStoragePath, defaultEntities);
const entityMentionRepository = new EntityMentionRepository(entityMentionStoragePath);
const entityResolutionService = new EntityResolutionService({ entityRepository, mentionRepository: entityMentionRepository });
const credibilityService = new CredibilityService({ repository: sourceProfileRepository });
const storyClusteringService = new StoryClusteringService({
  eventRepository: repository,
  analysisRepository,
  storyRepository,
  entityResolutionService,
});
const analysisService = new AnalysisService({
  eventRepository: repository,
  analysisRepository,
  storyClusteringService,
  nlpPipeline: new FinancialNLPipeline({
    modelName: nlpModelName,
    modelVersion: nlpModelVersion,
    entityResolutionService,
  }),
});
const alertService = new AlertService({ riskRepository, alertRepository });
const entityRiskBaselineRepository = new EntityRiskBaselineRepository(entityRiskBaselineStoragePath);
const earlyWarningRepository = new EarlyWarningRepository(earlyWarningStoragePath);
const earlyWarningService = new EarlyWarningService({
  riskRepository,
  eventRepository: repository,
  analysisRepository,
  entityRepository,
  baselineRepository: entityRiskBaselineRepository,
  warningRepository: earlyWarningRepository,
  alertService,
});
const riskService = new RiskService({
  eventRepository: repository,
  analysisRepository,
  riskRepository,
  alertService,
  credibilityService,
  storyClusteringService,
  entityResolutionService,
  earlyWarningService,
});
const riskAggregationService = new RiskAggregationService({ riskRepository, entityResolutionService });
const dashboardService = new DashboardService({ riskRepository, riskAggregationService, alertService });

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', createIngestionRouter(service));
app.use('/api/v1', createAnalysisRouter(analysisService));
app.use('/api/v1', createSourceRouter(credibilityService));
app.use('/api/v1', createStoryRouter(storyClusteringService));
app.use('/api/v1', createEntityRouter({ entityResolutionService, eventRepository: repository, riskRepository, riskAggregationService, earlyWarningService }));
app.use('/api/v1', createEarlyWarningRouter(earlyWarningService));
app.use('/api/v1', createRiskRouter(riskService));
app.use('/api/v1', createAggregationRouter(riskAggregationService));
app.use('/api/v1', createDashboardRouter(dashboardService));
app.use('/api/v1', createAlertRouter(alertService));

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'financial-ai-risk-engine',
      status: 'ok',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.originalUrl}`,
    },
  });
});

app.use((error, req, res, next) => {
  logger.error('Unhandled API error', {
    path: req.originalUrl,
    method: req.method,
    error: error.message,
    details: error.details || [],
  });

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred.',
      details: error.details || [],
    },
  });
});

const resetIngestionForTests = () => {
  service.reset();
  analysisService.reset();
  riskService.reset();
  riskAggregationService.reset();
  alertService.reset?.();
  credibilityService.reset();
  storyClusteringService.reset();
  entityMentionRepository.reset();
  earlyWarningService.reset();
};

module.exports = {
  app,
  resetIngestionForTests,
  analysisService,
  riskService,
  storyClusteringService,
  riskAggregationService,
  alertService,
  dashboardService,
  credibilityService,
  entityResolutionService,
  earlyWarningService,
};
