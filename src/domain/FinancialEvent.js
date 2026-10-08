const { v4: uuidv4 } = require('uuid');
const { normalizeText, normalizeTimestamp, contentHash, normalizeSource } = require('../utils/text');

const buildFinancialEvent = (payload) => {
  const normalizedPayload = {
    source: normalizeSource(payload.source),
    source_event_id: payload.source_event_id ? String(payload.source_event_id).trim() : null,
    title: normalizeText(payload.title),
    content: normalizeText(payload.content),
    url: payload.url ? String(payload.url).trim() : null,
    author: payload.author ? normalizeText(payload.author) : null,
    published_at: normalizeTimestamp(payload.published_at),
    ingested_at: new Date().toISOString(),
    language: String(payload.language).trim().toLowerCase(),
    event_type: String(payload.event_type).trim().toLowerCase(),
    metadata: {
      ...(payload.metadata || {}),
      source_adapter: normalizeSource(payload.source),
      content_hash: contentHash(payload.content),
    },
  };

  return {
    id: uuidv4(),
    source: normalizedPayload.source,
    source_event_id: normalizedPayload.source_event_id,
    title: normalizedPayload.title,
    content: normalizedPayload.content,
    url: normalizedPayload.url,
    author: normalizedPayload.author,
    published_at: normalizedPayload.published_at,
    ingested_at: normalizedPayload.ingested_at,
    language: normalizedPayload.language,
    event_type: normalizedPayload.event_type,
    metadata: normalizedPayload.metadata,
    content_hash: normalizedPayload.metadata.content_hash,
  };
};

module.exports = {
  buildFinancialEvent,
};
