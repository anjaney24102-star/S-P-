const { SourceAdapter } = require('./sourceAdapter');

class SocialAdapter extends SourceAdapter {
  constructor() {
    super('social', 'market', ['social_media', 'chat']);
  }
}

module.exports = { SocialAdapter };
