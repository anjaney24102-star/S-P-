const express = require('express');
const { createDashboardController } = require('../controllers/dashboardController');

const createDashboardRouter = (service) => {
  const router = express.Router();
  const controller = createDashboardController(service);

  router.get('/dashboard/summary', controller.getDashboardSummary);
  router.get('/dashboard/entity/:entity', controller.getEntityDashboard);
  router.get('/dashboard/entity/:entity/history', controller.getRiskHistory);
  router.get('/dashboard/stream', controller.streamDashboard);

  return router;
};

module.exports = { createDashboardRouter };
