const createSignalOutputController = (service) => {
  const respond = (res, operation) => {
    try {
      const result = operation();
      return res.status(200).json(result);
    } catch (error) {
      const status = Number(error.statusCode);
      const clientError = status >= 400 && status < 500;
      return res.status(clientError ? status : 500).json({
        error: {
          code: clientError ? (error.code || 'INVALID_PARAMETER') : 'INTERNAL_ERROR',
          message: clientError ? error.message : 'Unable to retrieve risk signals.',
        },
      });
    }
  };
  return {
    list: (req, res) => respond(res, () => service.list(req.query)),
    recent: (req, res) => respond(res, () => service.list(req.query)),
    byId: (req, res) => respond(res, () => ({
      data: service.getById(req.params.id),
      meta: { page: 1, limit: 1, total: 1 },
    })),
    forEntity: (req, res) => respond(res, () => service.list(req.query, req.params.entity)),
  };
};

module.exports = { createSignalOutputController };
