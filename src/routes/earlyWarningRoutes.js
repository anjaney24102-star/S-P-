const express = require('express');
const { createEarlyWarningController } = require('../controllers/earlyWarningController');

const createEarlyWarningRouter = (service) => {
  const router = express.Router();
  const controller = createEarlyWarningController(service);
  router.get('/warnings', controller.list);
  return router;
};

module.exports = { createEarlyWarningRouter };
