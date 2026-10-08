const express = require('express');
const { createIngestionController } = require('../controllers/ingestionController');

const createIngestionRouter = (service) => {
  const router = express.Router();
  const controller = createIngestionController(service);

  router.post('/events', controller.ingestOne);
  router.post('/events/batch', controller.ingestBatch);
  router.get('/events/recent', controller.getRecent);

  return router;
};

module.exports = {
  createIngestionRouter,
};
