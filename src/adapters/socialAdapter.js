const { SourceAdapter } = require('./sourceAdapter');

class SocialAdapter extends SourceAdapter {
  constructor() {
    super('social', 'market', ['social_media', 'chat', 'twitter', 'x']);
  }

  normalize(payload = {}) {
    const next = super.normalize(payload);
    return {
      ...next,
      source: next.source || 'social',
      text: next.text || normalizeText(payload.post || payload.tweet || payload.message || ''),
      content: next.text || normalizeText(payload.post || payload.tweet || payload.message || ''),
      metadata: {
        ...(next.metadata || {}),
        source_adapter: 'social',
      },
    };
  }
}

const { normalizeText } = require('../utils/text');

module.exports = { SocialAdapter };
