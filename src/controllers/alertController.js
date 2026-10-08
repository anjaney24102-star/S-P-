const createAlertController = (service) => ({
  getAlerts: async (req, res, next) => {
    try {
      const alerts = service.getAlerts({
        entity: req.query.entity || undefined,
        acknowledged: req.query.acknowledged === undefined ? undefined : req.query.acknowledged === 'true',
        riskLevel: req.query.risk_level || req.query.riskLevel || undefined,
        source: req.query.source || undefined,
        eventType: req.query.event_type || req.query.eventType || undefined,
        since: req.query.since || undefined,
        limit: Number(req.query.limit || 25),
      });
      return res.status(200).json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  },

  acknowledgeAlert: async (req, res, next) => {
    try {
      const { alertId } = req.params;
      const alert = service.acknowledgeAlert(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Alert was not found.',
          },
        });
      }

      return res.status(200).json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  },

  getAlertConfig: async (req, res, next) => {
    try {
      const config = service.getConfig();
      return res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },

  updateAlertConfig: async (req, res, next) => {
    try {
      const body = req.body || {};
      const allowedKeys = [
        'risk_score_threshold',
        'increase_threshold',
        'rapid_deterioration_threshold',
        'activity_spike_min_events',
        'activity_spike_multiplier',
        'cooldown_ms',
      ];

      const updates = Object.fromEntries(Object.entries(body).filter(([key]) => allowedKeys.includes(key)));
      const config = service.updateConfig(updates);
      return res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createAlertController };
