const { allowedSources } = require('../config');
const { normalizeText, normalizeTimestamp, normalizeSource } = require('../utils/text');

const validLanguagePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)?$/;

const validateFinancialTextInput = (payload = {}) => {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ['Request body must be a valid object.'],
      normalized: null,
    };
  }

  const source = normalizeSource(payload.source || 'news');
  const text = normalizeText(payload.text ?? payload.content ?? payload.body ?? payload.post ?? payload.article ?? '');
  const sourceId = payload.source_id ?? payload.source_event_id ?? payload.id ?? payload.external_id ?? null;
  const normalized = {
    source,
    source_id: sourceId ? String(sourceId).trim() : null,
    text,
    title: payload.title ? normalizeText(payload.title) : null,
    author: payload.author ? normalizeText(payload.author) : null,
    url: typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : payload.url || null,
    published_at: payload.published_at ?? payload.timestamp ?? null,
    language: typeof payload.language === 'string' ? payload.language.trim().toLowerCase() : payload.language || 'en',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
  };

  if (!normalized.source) {
    errors.push('source is required');
  } else if (!allowedSources.includes(normalized.source)) {
    errors.push(`source is not supported: ${normalized.source}`);
  }

  if (!normalized.text) {
    errors.push('text is required');
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

  if (normalized.url && !/^https?:\/\//i.test(normalized.url)) {
    errors.push('url must be a valid http or https URL');
  }

  if (normalized.source_id === null && payload.source_id !== undefined && payload.source_id !== null) {
    errors.push('source_id is malformed');
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
};

module.exports = { validateFinancialTextInput };
