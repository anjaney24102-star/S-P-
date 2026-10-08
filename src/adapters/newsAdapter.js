const { SourceAdapter } = require('./sourceAdapter');

class NewsAdapter extends SourceAdapter {
  constructor() {
    super('news', 'macro');
  }
}

module.exports = { NewsAdapter };
