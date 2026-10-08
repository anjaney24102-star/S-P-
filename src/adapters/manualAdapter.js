const { SourceAdapter } = require('./sourceAdapter');

class ManualAdapter extends SourceAdapter {
  constructor() {
    super('manual', 'manual');
  }
}

module.exports = { ManualAdapter };
