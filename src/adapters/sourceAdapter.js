const { normalizeSource } = require('../utils/text');

class SourceAdapter {
  constructor(sourceName, defaultEventType = 'general') {
    this.sourceName = normalizeSource(sourceName);
    this.defaultEventType = defaultEventType;
  }

  supports(source) {
    return normalizeSource(source) === this.sourceName;
  }

  normalize(payload = {}) {
    return {
      ...payload,
      source: this.sourceName,
      event_type: payload.event_type || this.defaultEventType,
      metadata: {
        ...(payload.metadata || {}),
        source_adapter: this.sourceName,
      },
    };
  }
}

module.exports = { SourceAdapter };
