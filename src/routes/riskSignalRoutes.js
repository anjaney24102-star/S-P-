const express = require('express');
const { createRiskSignalController } = require('../controllers/riskSignalController');
const { createSignalOutputController } = require('../controllers/signalOutputController');

const createRiskSignalRouter = (service, outputService) => {
  const router = express.Router();
  const controller = createRiskSignalController(service);
  const output = createSignalOutputController(outputService);
  router.post('/events/:id/signal', controller.create);
  router.get('/events/:id/signal', controller.get);
  router.get('/signals/recent', output.recent);
  router.get('/signals/:id', output.byId);
  router.get('/signals', output.list);
  router.get('/entities/:entity/signals', output.forEntity);
  return router;
};

module.exports = { createRiskSignalRouter };
