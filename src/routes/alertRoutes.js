const express = require('express');
const { createAlertController } = require('../controllers/alertController');

const createAlertRouter = (service) => {
  const router = express.Router();
  const controller = createAlertController(service);

  router.get('/alerts', controller.getAlerts);
  router.post('/alerts/:alertId/acknowledge', controller.acknowledgeAlert);
  router.get('/alerts/config', controller.getAlertConfig);
  router.put('/alerts/config', controller.updateAlertConfig);

  return router;
};

module.exports = { createAlertRouter };
