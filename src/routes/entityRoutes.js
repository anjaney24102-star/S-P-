const express = require('express');
const { createEntityController } = require('../controllers/entityController');

const createEntityRouter = (dependencies) => {
  const router = express.Router();
  const controller = createEntityController(dependencies);
  router.get('/entities', controller.list);
  router.get('/entities/:id/events', controller.events);
  router.get('/entities/:id/risk', controller.risk);
  router.get('/entities/:id/warnings', controller.warnings);
  router.get('/entities/:id/baseline', controller.baseline);
  router.get('/entities/:id', controller.get);
  return router;
};

module.exports = { createEntityRouter };
