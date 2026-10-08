const createDashboardController = (service) => ({
  getDashboardSummary: async (req, res, next) => {
    try {
      const filters = {
        entity: req.query.entity || undefined,
        sector: req.query.sector || undefined,
        riskLevel: req.query.risk_level || req.query.riskLevel || undefined,
        eventType: req.query.event_type || req.query.eventType || undefined,
        source: req.query.source || undefined,
        start: req.query.start || undefined,
        end: req.query.end || undefined,
        window: req.query.window || '24h',
        limit: Number(req.query.limit || 10),
      };

      const summary = service.getDashboardSummary(filters);
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  getEntityDashboard: async (req, res, next) => {
    try {
      const { entity } = req.params;
      const dashboard = service.getEntityDashboard(entity, {
        window: req.query.window || '24h',
        limit: Number(req.query.limit || 10),
      });
      return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  },

  getRiskHistory: async (req, res, next) => {
    try {
      const { entity } = req.params;
      const history = service.getRiskHistory(entity, {
        window: req.query.window || '24h',
      });
      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  },

  streamDashboard: async (req, res, next) => {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendUpdate = () => {
        const summary = service.getDashboardSummary({ window: req.query.window || '24h' });
        res.write(`data: ${JSON.stringify({ success: true, data: summary })}\n\n`);
      };

      sendUpdate();
      const timer = setInterval(sendUpdate, 15000);
      req.on('close', () => clearInterval(timer));
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createDashboardController };
