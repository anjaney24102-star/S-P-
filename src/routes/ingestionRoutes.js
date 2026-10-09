const express = require('express');
const { createIngestionController } = require('../controllers/ingestionController');

const createIngestionRouter = (service) => {
  const router = express.Router();
  const controller = createIngestionController(service);

  router.post('/events', controller.ingestOne);
  router.post('/events/batch', controller.ingestBatch);
  router.get('/events', controller.listEvents);
  router.get('/events/recent', controller.getRecent);
  router.post('/ingest/news', controller.ingestNews);
  router.post('/ingest/social', controller.ingestSocial);

  return router;
};

module.exports = {
  createIngestionRouter,
};
