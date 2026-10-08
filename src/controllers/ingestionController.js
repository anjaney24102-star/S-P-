const { logger } = require('../utils/logger');

const createIngestionController = (service) => ({
  ingestOne: async (req, res, next) => {
    try {
      const event = service.ingestOne(req.body);
      logger.info('Single event ingested via API', { source: event.source });
      return res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  },

  ingestBatch: async (req, res, next) => {
    try {
      const payload = req.body && Array.isArray(req.body.events) ? req.body.events : [];
      const result = service.ingestBatch(payload);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getRecent: async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 20);
      const events = service.getRecent(limit);

      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = {
  createIngestionController,
};
