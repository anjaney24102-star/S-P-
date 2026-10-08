const { app } = require('./app');
const { port } = require('./config');
const { logger } = require('./utils/logger');

app.listen(port, () => {
  logger.info('Financial AI Risk Engine started', {
    port,
  });
});
