const { NewsAdapter } = require('./newsAdapter');
const { SocialAdapter } = require('./socialAdapter');
const { ManualAdapter } = require('./manualAdapter');

class SourceAdapterRegistry {
  constructor() {
    this.adapters = [
      new NewsAdapter(),
      new SocialAdapter(),
      new ManualAdapter(),
    ];
  }

  getAdapter(source) {
    const adapter = this.adapters.find((item) => item.supports(source));

    if (!adapter) {
      throw new Error(`Unsupported source adapter for: ${source}`);
    }

    return adapter;
  }
}

module.exports = { SourceAdapterRegistry };
