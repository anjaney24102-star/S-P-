const { allowedSources } = require('../config');
const { normalizeText, normalizeTimestamp } = require('../utils/text');

const validLanguagePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$/;

const validateFinancialEventInput = (payload = {}) => {
  const errors = [];

  const normalized = {
    source: String(payload.source || '').trim().toLowerCase(),
    title: normalizeText(payload.title),
    content: normalizeText(payload.content),
    url: typeof payload.url === 'string' ? payload.url.trim() : payload.url || null,
    author: typeof payload.author === 'string' ? normalizeText(payload.author) : payload.author || null,
    published_at: payload.published_at,
    language: typeof payload.language === 'string' ? payload.language.trim().toLowerCase() : payload.language || null,
    event_type: typeof payload.event_type === 'string' ? payload.event_type.trim().toLowerCase() : payload.event_type || null,
    source_event_id: typeof payload.source_event_id === 'string' ? payload.source_event_id.trim() : payload.source_event_id || null,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
  };

  if (!normalized.source) {
    errors.push('source is required');
  } else if (!allowedSources.includes(normalized.source)) {
    errors.push(`source is not supported: ${normalized.source}`);
  }

  if (!normalized.title) {
    errors.push('title is required');
  }

  if (!normalized.content) {
    errors.push('content is required');
  }

  if (!normalized.published_at) {
    errors.push('published_at is required');
  } else {
    try {
      normalized.published_at = normalizeTimestamp(normalized.published_at);
    } catch (error) {
      errors.push('published_at is invalid');
    }
  }

  if (!normalized.language) {
    errors.push('language is required');
  } else if (!validLanguagePattern.test(normalized.language)) {
    errors.push('language must be a valid ISO language code');
  }

  if (!normalized.event_type) {
    errors.push('event_type is required');
  }

  if (normalized.url && !/^https?:\/\//i.test(normalized.url)) {
    errors.push('url must be a valid http or https URL');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
};

module.exports = {
  validateFinancialEventInput,
};
