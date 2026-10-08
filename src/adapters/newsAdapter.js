const { SourceAdapter } = require('./sourceAdapter');

class NewsAdapter extends SourceAdapter {
  constructor() {
    super('news', 'macro', ['major_news', 'financial_news', 'company_announcement']);
  }
}

module.exports = { NewsAdapter };
