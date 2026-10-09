const { normalizeSource, normalizeText } = require('../utils/text');

class SourceAdapter {
  constructor(sourceName, defaultEventType = 'general', aliases = []) {
    this.sourceName = normalizeSource(sourceName);
    this.defaultEventType = defaultEventType;
    this.aliases = [this.sourceName, ...aliases].map((item) => normalizeSource(item)).filter(Boolean);
  }

  supports(source) {
    return this.aliases.includes(normalizeSource(source));
  }

  normalize(payload = {}) {
    const sourceName = normalizeSource(payload.source || this.sourceName || '') || this.sourceName;
    const bodyText = normalizeText(payload.text ?? payload.content ?? payload.body ?? payload.post ?? payload.article ?? '');
    const sourceId = payload.source_id ?? payload.source_event_id ?? payload.id ?? payload.external_id ?? null;

    return {
      ...payload,
      source: sourceName,
      source_id: sourceId ? String(sourceId).trim() : null,
      text: bodyText,
      content: bodyText,
      title: payload.title ? normalizeText(payload.title) : null,
      author: payload.author ? normalizeText(payload.author) : null,
      url: payload.url ? String(payload.url).trim() : null,
      published_at: payload.published_at ?? payload.timestamp ?? null,
      language: typeof payload.language === 'string' ? payload.language.trim().toLowerCase() : payload.language || 'en',
      event_type: payload.event_type || this.defaultEventType,
      metadata: {
        ...(payload.metadata || {}),
        source_adapter: this.sourceName,
      },
    };
  }
}

module.exports = { SourceAdapter };
