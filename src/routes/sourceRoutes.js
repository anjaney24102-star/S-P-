const express = require('express');
const { createSourceController } = require('../controllers/sourceController');

const createSourceRouter = (service) => {
  const router = express.Router();
  const controller = createSourceController(service);

  router.get('/sources', controller.listSources);
  router.get('/sources/:source', controller.getSource);
  router.post('/sources', controller.createSource);

  return router;
};

module.exports = { createSourceRouter };
