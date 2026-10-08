const createSourceController = (service) => ({
  listSources: async (req, res, next) => {
    try {
      const sources = service.getAllSources();
      return res.status(200).json({
        success: true,
        data: sources,
      });
    } catch (error) {
      next(error);
    }
  },

  getSource: async (req, res, next) => {
    try {
      const source = service.getSourceProfile(req.params.source);
      if (!source) {
        const error = new Error(`Source profile not found: ${req.params.source}`);
        error.statusCode = 404;
        error.code = 'SOURCE_NOT_FOUND';
        throw error;
      }

      return res.status(200).json({
        success: true,
        data: source,
      });
    } catch (error) {
      next(error);
    }
  },

  createSource: async (req, res, next) => {
    try {
      const profile = service.upsertSourceProfile(req.body);
      return res.status(201).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createSourceController };
