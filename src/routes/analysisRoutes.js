const express = require('express');
const { createAnalysisController } = require('../controllers/analysisController');

const createAnalysisRouter = (service) => {
  const router = express.Router();
  const controller = createAnalysisController(service);

  router.post('/events/:eventId/analyze', controller.analyzeEvent);
  router.get('/events/:eventId/analysis', controller.getAnalysisForEvent);
  router.get('/analyses/recent', controller.getRecentAnalyses);

  return router;
};

module.exports = { createAnalysisRouter };
