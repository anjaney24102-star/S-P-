const { SourceAdapter } = require('./sourceAdapter');

class ManualAdapter extends SourceAdapter {
  constructor() {
    super('manual', 'manual', ['research', 'analyst_note']);
  }
}

module.exports = { ManualAdapter };
