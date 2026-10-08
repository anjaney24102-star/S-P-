const express = require('express');
const { createRiskController } = require('../controllers/riskController');

const createRiskRouter = (service) => {
  const router = express.Router();
  const controller = createRiskController(service);

  router.post('/risk/analyze/:eventId', controller.analyzeRisk);
  router.get('/risk/:entity', controller.getRiskByEntity);
  router.get('/risk/recent', controller.getRecentSignals);

  return router;
};

module.exports = { createRiskRouter };
