const createRiskSignalController = (service) => ({
  create: (req, res, next) => {
    try {
      const result = service.generateForEvent(req.params.id);
      return res.status(result.created ? 201 : 200).json({
        data: result,
        meta: { page: 1, limit: result.signals.length, total: result.signals.length },
      });
    } catch (error) { return next(error); }
  },
  get: (req, res, next) => {
    try {
      const signals = service.getAllForEvent(req.params.id);
      return res.status(200).json({ data: { signal: signals[0], signals }, meta: { page: 1, limit: signals.length, total: signals.length } });
    }
    catch (error) { return next(error); }
  },
});

module.exports = { createRiskSignalController };
