const createEarlyWarningController = (service) => ({
  list: (req, res, next) => {
    try {
      const warnings = service.getWarnings({ window: req.query.window, severity: req.query.severity, entity_id: req.query.entity_id, limit: req.query.limit });
      return res.status(200).json({ success: true, data: warnings });
    } catch (error) { return next(error); }
  },
});

module.exports = { createEarlyWarningController };
