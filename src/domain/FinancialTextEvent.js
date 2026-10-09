const { v4: uuidv4 } = require('uuid');
const { normalizeText, normalizeTimestamp, normalizeSource, contentHash } = require('../utils/text');

const buildFinancialTextEvent = (payload = {}) => {
  const source = normalizeSource(payload.source || 'news');
  const sourceId = payload.source_id ?? payload.source_event_id ?? payload.id ?? payload.external_id ?? null;
  const text = normalizeText(payload.text ?? payload.content ?? payload.body ?? payload.post ?? payload.article ?? '');
  const title = payload.title ? normalizeText(payload.title) : null;
  const publishedAt = normalizeTimestamp(payload.published_at ?? payload.timestamp ?? new Date().toISOString());
  const language = String(payload.language || 'en').trim().toLowerCase() || 'en';
  const metadata = {
    ...(payload.metadata || {}),
    source_adapter: source,
    content_hash: contentHash(text),
  };

  return {
    id: payload.id || uuidv4(),
    source,
    source_id: sourceId ? String(sourceId).trim() : null,
    source_event_id: sourceId ? String(sourceId).trim() : null,
    text,
    title,
    author: payload.author ? normalizeText(payload.author) : null,
    url: payload.url ? String(payload.url).trim() : null,
    published_at: publishedAt,
    ingested_at: payload.ingested_at || new Date().toISOString(),
    language,
    metadata,
    content: text,
    event_type: String(payload.event_type || source).trim().toLowerCase(),
    content_hash: metadata.content_hash,
  };
};

module.exports = { buildFinancialTextEvent };
