const express = require('express');
const { createStoryController } = require('../controllers/storyController');

const createStoryRouter = (service) => {
  const router = express.Router();
  const controller = createStoryController(service);

  router.get('/stories', controller.listStories);
  router.get('/stories/:storyId', controller.getStory);
  router.get('/entities/:entityName/stories', controller.getStoriesForEntity);

  return router;
};

module.exports = { createStoryRouter };
