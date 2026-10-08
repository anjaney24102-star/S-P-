const createRiskController = (service) => ({
  analyzeRisk: async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const result = service.analyzeRiskForEvent(eventId);
      return res.status(result.created ? 201 : 200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getRiskByEntity: async (req, res, next) => {
    try {
      const { entity } = req.params;
      const risks = service.getRiskForEntity(entity);
      return res.status(200).json({
        success: true,
        data: risks,
      });
    } catch (error) {
      next(error);
    }
  },

  getRecentSignals: async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 20);
      const risks = service.getRecentSignals(limit);
      return res.status(200).json({
        success: true,
        data: risks,
      });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createRiskController };
