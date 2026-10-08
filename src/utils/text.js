const crypto = require('crypto');

const normalizeText = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const normalizeTimestamp = (value) => {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Invalid timestamp provided.');
  }

  return timestamp.toISOString();
};

const normalizeSource = (value = '') => String(value).trim().toLowerCase();

const contentHash = (content = '') => {
  const normalized = normalizeText(content).toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

module.exports = {
  normalizeText,
  normalizeTimestamp,
  normalizeSource,
  contentHash,
};
