const createAggregationController = (service) => ({
  getEntitySummary: async (req, res, next) => {
    try {
      const { entity } = req.params;
      const window = req.query.window || '24h';
      const summary = service.getEntityRiskSummary(entity, { window });
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  getEntityHistory: async (req, res, next) => {
    try {
      const { entity } = req.params;
      const window = req.query.window || '24h';
      const history = service.getEntityRiskHistory(entity, { window });
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  },

  getEmergingRisks: async (req, res, next) => {
    try {
      const window = req.query.window || '24h';
      const risks = service.getEmergingRisks({ window });
      return res.status(200).json({ success: true, data: risks });
    } catch (error) {
      next(error);
    }
  },

  getRiskActivitySpikes: async (req, res, next) => {
    try {
      const window = req.query.window || '6h';
      const spikes = service.getRiskActivitySpikes({ window });
      return res.status(200).json({ success: true, data: spikes });
    } catch (error) {
      next(error);
    }
  },

  getSectorSummary: async (req, res, next) => {
    try {
      const { sector } = req.params;
      const window = req.query.window || '24h';
      const summary = service.getSectorRiskSummary(sector, { window });
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createAggregationController };
