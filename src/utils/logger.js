const { logLevel } = require('../config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[logLevel] ?? levels.info;

const log = (level, message, meta = {}) => {
  if ((levels[level] ?? -1) > currentLevel) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(Object.keys(meta).length ? { meta } : {}),
  };

  const output = `${JSON.stringify(payload)}`;

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  if (level === 'debug') {
    console.debug(output);
    return;
  }

  console.info(output);
};

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};

module.exports = { logger };
