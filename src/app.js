const express = require('express');
const { createIngestionRouter } = require('./routes/ingestionRoutes');
const { createAnalysisRouter } = require('./routes/analysisRoutes');
const { createRiskRouter } = require('./routes/riskRoutes');
const { createAggregationRouter } = require('./routes/aggregationRoutes');
const { createDashboardRouter } = require('./routes/dashboardRoutes');
const { createAlertRouter } = require('./routes/alertRoutes');
const { IngestionService } = require('./services/ingestionService');
const { EventRepository } = require('./repositories/eventRepository');
const { AnalysisRepository } = require('./repositories/analysisRepository');
const { RiskRepository } = require('./repositories/riskRepository');
const { AlertRepository } = require('./repositories/alertRepository');
const { SourceAdapterRegistry } = require('./adapters/sourceRegistry');
const { FinancialNLPipeline } = require('./nlp/nlpPipeline');
const { AnalysisService } = require('./services/analysisService');
const { RiskService } = require('./services/riskService');
const { RiskAggregationService } = require('./services/riskAggregationService');
const { AlertService } = require('./services/alertService');
const { DashboardService } = require('./services/dashboardService');
const { storagePath, analysisStoragePath, riskStoragePath, alertStoragePath, alertConfigPath, nlpModelName, nlpModelVersion } = require('./config');
const { logger } = require('./utils/logger');

const repository = new EventRepository(storagePath);
const service = new IngestionService({
  repository,
  sourceRegistry: new SourceAdapterRegistry(),
});

const analysisRepository = new AnalysisRepository(analysisStoragePath);
const analysisService = new AnalysisService({
  eventRepository: repository,
  analysisRepository,
  nlpPipeline: new FinancialNLPipeline({
    modelName: nlpModelName,
    modelVersion: nlpModelVersion,
  }),
});

const riskRepository = new RiskRepository(riskStoragePath);
const alertRepository = new AlertRepository(alertStoragePath, alertConfigPath);
const alertService = new AlertService({ riskRepository, alertRepository });
const riskService = new RiskService({
  eventRepository: repository,
  analysisRepository,
  riskRepository,
  alertService,
});
const riskAggregationService = new RiskAggregationService({ riskRepository });
const dashboardService = new DashboardService({ riskRepository, riskAggregationService, alertService });

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', createIngestionRouter(service));
app.use('/api/v1', createAnalysisRouter(analysisService));
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
};

module.exports = {
  app,
  resetIngestionForTests,
  analysisService,
  riskService,
  riskAggregationService,
  alertService,
  dashboardService,
};
