const { SourceAdapter } = require('./sourceAdapter');

class SocialAdapter extends SourceAdapter {
  constructor() {
    super('social', 'market');
  }
}

module.exports = { SocialAdapter };
