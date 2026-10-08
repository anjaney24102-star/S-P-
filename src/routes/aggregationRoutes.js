const express = require('express');
const { createAggregationController } = require('../controllers/aggregationController');

const createAggregationRouter = (service) => {
  const router = express.Router();
  const controller = createAggregationController(service);

  router.get('/risk/entity/:entity/summary', controller.getEntitySummary);
  router.get('/risk/entity/:entity/history', controller.getEntityHistory);
  router.get('/risk/emerging', controller.getEmergingRisks);
  router.get('/risk/activity-spikes', controller.getRiskActivitySpikes);
  router.get('/risk/sector/:sector/summary', controller.getSectorSummary);

  return router;
};

module.exports = { createAggregationRouter };
