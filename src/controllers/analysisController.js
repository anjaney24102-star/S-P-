const createAnalysisController = (service) => ({
  analyzeEvent: async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { force } = req.query;
      const result = service.analyzeEvent(eventId, { force: force === 'true' || force === '1' });

      return res.status(result.reused ? 200 : 201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getAnalysisForEvent: async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const analysis = service.getAnalysisForEvent(eventId);
      return res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  },

  getRecentAnalyses: async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 20);
      const analyses = service.getRecentAnalyses(limit);
      return res.status(200).json({
        success: true,
        data: analyses,
      });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createAnalysisController };
