const { SourceAdapter } = require('./sourceAdapter');

class NewsAdapter extends SourceAdapter {
  constructor() {
    super('news', 'macro', ['major_news', 'financial_news', 'company_announcement']);
  }

  normalize(payload = {}) {
    const next = super.normalize(payload);
    return {
      ...next,
      source: next.source || 'news',
      title: next.title || (payload.headline ? String(payload.headline).trim() : null),
      text: next.text || normalizeText(payload.summary || payload.snippet || payload.excerpt || ''),
      content: next.text || normalizeText(payload.summary || payload.snippet || payload.excerpt || ''),
      metadata: {
        ...(next.metadata || {}),
        source_adapter: 'news',
      },
    };
  }
}

const { normalizeText } = require('../utils/text');

module.exports = { NewsAdapter };
