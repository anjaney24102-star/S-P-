const createStoryController = (service) => ({
  listStories: (req, res, next) => {
    try {
      const stories = service.listStories();
      res.status(200).json({
        success: true,
        data: stories,
      });
    } catch (error) {
      next(error);
    }
  },

  getStory: (req, res, next) => {
    try {
      const story = service.storyRepository?.findById(req.params.storyId) || null;
      if (!story) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'STORY_NOT_FOUND',
            message: `Story not found: ${req.params.storyId}`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: story,
      });
    } catch (error) {
      return next(error);
    }
  },

  getStoriesForEntity: (req, res, next) => {
    try {
      const stories = service.getStoriesByEntity(req.params.entityName);
      res.status(200).json({
        success: true,
        data: stories,
      });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = { createStoryController };
