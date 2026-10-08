const { normalizeSource } = require('../utils/text');

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
    const sourceName = String(payload.source || this.sourceName || '').trim().toLowerCase() || this.sourceName;

    return {
      ...payload,
      source: sourceName,
      event_type: payload.event_type || this.defaultEventType,
      metadata: {
        ...(payload.metadata || {}),
        source_adapter: this.sourceName,
      },
    };
  }
}

module.exports = { SourceAdapter };
